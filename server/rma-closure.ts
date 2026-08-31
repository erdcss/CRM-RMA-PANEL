import { and, count, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";

import {
  products,
  rmaCustomerDeliveries,
  rmaPackageItems,
  rmaPackages,
  rmaShipments,
  rmaSupplierResults,
  tickets,
} from "@shared/schema";
import { isFinalProductStatus } from "@shared/supplier-result-constants";
import { db } from "./db";
import { ensureFaz3Tables, getActiveSupplierResult, getOwnedTicket } from "./supplier-results";
import { getOwnedProduct } from "./suppliers";

export type ClosureCheckItem = {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export async function getTicketClosureStatus(ticketId: number, ownerUserId: string) {
  await ensureFaz3Tables();
  const ticket = await getOwnedTicket(ticketId, ownerUserId);
  if (!ticket) throw new Error("Kayit bulunamadi veya erisim yok");

  const ticketProducts = await db.select().from(products).where(eq(products.ticketId, ticketId));
  const totalProducts = ticketProducts.length;

  const checks: ClosureCheckItem[] = [];
  const blockers: string[] = [];

  let finalizedCount = 0;
  for (const p of ticketProducts) {
    if (isFinalProductStatus(p.status)) finalizedCount++;
  }

  const allFinalized = totalProducts > 0 && finalizedCount === totalProducts;
  checks.push({
    key: "products_finalized",
    label: `${finalizedCount}/${totalProducts} urun sonuclandi`,
    ok: allFinalized,
  });
  if (!allFinalized) {
    blockers.push(`${totalProducts - finalizedCount} urun nihai duruma ulasmadi`);
  }

  const productIds = ticketProducts.map((p) => p.id);
  let openPackages = 0;
  if (productIds.length) {
    const openPkgRows = await db
      .select({ packageId: rmaPackageItems.packageId })
      .from(rmaPackageItems)
      .innerJoin(rmaPackages, eq(rmaPackageItems.packageId, rmaPackages.id))
      .where(
        and(
          inArray(rmaPackageItems.productId, productIds),
          isNull(rmaPackageItems.removedAt),
          eq(rmaPackages.ownerUserId, ownerUserId),
          notInArray(rmaPackages.status, ["tamamlandi", "iptal"]),
        ),
      );
    openPackages = new Set(openPkgRows.map((r) => r.packageId)).size;
  }

  checks.push({
    key: "packages_closed",
    label: openPackages === 0 ? "Tedarikci islemleri tamamlandi" : `${openPackages} acik koli var`,
    ok: openPackages === 0,
  });
  if (openPackages > 0) blockers.push(`${openPackages} acik koli iliskisi var`);

  let activeShipments = 0;
  if (productIds.length) {
    const shipmentRows = await db
      .select({ id: rmaShipments.id })
      .from(rmaShipments)
      .innerJoin(rmaPackages, eq(rmaShipments.packageId, rmaPackages.id))
      .innerJoin(rmaPackageItems, eq(rmaPackageItems.packageId, rmaPackages.id))
      .where(
        and(
          inArray(rmaPackageItems.productId, productIds),
          isNull(rmaPackageItems.removedAt),
          eq(rmaShipments.ownerUserId, ownerUserId),
          eq(rmaShipments.status, "sevk_edildi"),
          inArray(rmaPackages.status, ["sevk_edildi", "tedarikcide"]),
        ),
      );
    activeShipments = new Set(shipmentRows.map((r) => r.id)).size;
  }

  checks.push({
    key: "no_active_shipments",
    label: activeShipments === 0 ? "Acik sevkiyat yok" : `${activeShipments} aktif sevkiyat`,
    ok: activeShipments === 0,
  });
  if (activeShipments > 0) blockers.push("Aktif sevkiyat var");

  let awaitingSupplierResult = 0;
  for (const p of ticketProducts) {
    if (p.status === "sonuc_bekliyor" || p.status === "tedarikcide") awaitingSupplierResult++;
    const result = await getActiveSupplierResult(p.id, ownerUserId);
    if (result?.resultType === "sonuc_bekliyor") awaitingSupplierResult++;
  }

  checks.push({
    key: "supplier_results",
    label:
      awaitingSupplierResult === 0
        ? "Tedarikci sonuclari tamam"
        : `${awaitingSupplierResult} urun tedarikci sonucu bekliyor`,
    ok: awaitingSupplierResult === 0,
  });
  if (awaitingSupplierResult > 0) blockers.push("Tedarikci sonucu bekleyen urun var");

  let servisUndelivered = 0;
  for (const p of ticketProducts) {
    const op = ticket.operationType || p.category;
    if (op !== "servis") continue;
    if (p.status !== "musteriye_teslim_edildi" && p.status !== "teslim_edildi") {
      const delivery = await db
        .select()
        .from(rmaCustomerDeliveries)
        .where(and(eq(rmaCustomerDeliveries.productId, p.id), eq(rmaCustomerDeliveries.ownerUserId, ownerUserId)))
        .limit(1);
      if (!delivery.length) servisUndelivered++;
    }
  }

  if (ticket.operationType === "servis" || ticketProducts.some((p) => p.category === "servis")) {
    checks.push({
      key: "servis_delivered",
      label:
        servisUndelivered === 0
          ? "Servis urunleri musteriye teslim edildi"
          : `${servisUndelivered} servis urunu musteriye teslim edilmedi`,
      ok: servisUndelivered === 0,
    });
    if (servisUndelivered > 0) blockers.push(`${servisUndelivered} servis urunu musteriye teslim edilmedi`);
  }

  const canClose = blockers.length === 0 && ticket.rmaStatus !== "closed";

  return {
    ticketId,
    rmaStatus: ticket.rmaStatus || "open",
    canClose,
    checks,
    blockers,
    closedAt: ticket.rmaClosedAt,
  };
}

export async function closeTicket(ticketId: number, ownerUserId: string, userId: string) {
  await ensureFaz3Tables();
  const status = await getTicketClosureStatus(ticketId, ownerUserId);
  if (!status.canClose) {
    throw new Error(`RMA kapatilamaz: ${status.blockers.join("; ")}`);
  }

  const ticket = await getOwnedTicket(ticketId, ownerUserId);
  if (!ticket) throw new Error("Kayit bulunamadi");

  const now = new Date();
  return db.transaction(async (tx) => {
    await tx
      .update(tickets)
      .set({
        rmaStatus: "closed",
        rmaClosedAt: now,
        rmaClosedByUserId: userId,
        updatedAt: now,
      })
      .where(eq(tickets.id, ticketId));

    const ticketProducts = await tx.select().from(products).where(eq(products.ticketId, ticketId));
    for (const p of ticketProducts) {
      if (!isFinalProductStatus(p.status)) {
        throw new Error(`Urun ${p.id} nihai durumda degil: ${p.status}`);
      }
    }

    return getTicketClosureStatus(ticketId, ownerUserId);
  });
}

export async function verifyProductOwnership(productId: number, ownerUserId: string) {
  const product = await getOwnedProduct(productId, ownerUserId);
  return Boolean(product);
}

export async function verifyPackageOwnership(packageId: number, ownerUserId: string) {
  const [pkg] = await db
    .select()
    .from(rmaPackages)
    .where(and(eq(rmaPackages.id, packageId), eq(rmaPackages.ownerUserId, ownerUserId)))
    .limit(1);
  return Boolean(pkg);
}
