import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  products,
  rmaCustomerDeliveries,
  rmaPackageHistory,
  rmaPackageItems,
  rmaPackages,
  rmaProductMovements,
  rmaScrapRecords,
  rmaSupplierResultHistory,
  rmaSupplierResults,
  statusHistory,
  tickets,
} from "@shared/schema";
import {
  FINAL_PRODUCT_STATUSES,
  SUPPLIER_RESULT_TYPE_VALUES,
  requiresNewSerial,
} from "@shared/supplier-result-constants";
import { getSupplierResultLabel } from "@shared/supplier-result-constants";
import { db } from "./db";
import { getOwnedProduct } from "./suppliers";
import { ensurePackageTables, getPackageDetail } from "./packages";

let faz3Promise: Promise<void> | null = null;

export function ensureFaz3Tables() {
  if (!faz3Promise) {
    faz3Promise = (async () => {
      await ensurePackageTables();
      await db.execute(sql`ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS delivered_to_supplier_at TIMESTAMP`);
      await db.execute(sql`ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS delivered_by_user_id TEXT`);
      await db.execute(sql`ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS delivery_note TEXT`);
      await db.execute(sql`ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP`);
      await db.execute(sql`ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS returned_by_user_id TEXT`);
      await db.execute(sql`ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS return_note TEXT`);
      await db.execute(sql`ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`);
      await db.execute(sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rma_status TEXT DEFAULT 'open'`);
      await db.execute(sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rma_closed_at TIMESTAMP`);
      await db.execute(sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rma_closed_by_user_id TEXT`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS rma_supplier_results (
          id SERIAL PRIMARY KEY,
          owner_user_id TEXT NOT NULL,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          package_id INTEGER REFERENCES rma_packages(id) ON DELETE SET NULL,
          supplier_account_code TEXT NOT NULL,
          result_type TEXT NOT NULL,
          result_description TEXT,
          supplier_document_number TEXT,
          supplier_serial_number TEXT,
          old_serial_number TEXT,
          new_serial_number TEXT,
          new_barcode TEXT,
          result_date TIMESTAMP NOT NULL DEFAULT NOW(),
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_by_user_id TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS rma_supplier_results_active_product_unique
        ON rma_supplier_results (product_id) WHERE is_active = TRUE
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS rma_supplier_result_history (
          id SERIAL PRIMARY KEY,
          supplier_result_id INTEGER NOT NULL REFERENCES rma_supplier_results(id) ON DELETE CASCADE,
          owner_user_id TEXT NOT NULL,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          previous_result_type TEXT,
          new_result_type TEXT NOT NULL,
          snapshot TEXT,
          changed_by_user_id TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS rma_customer_deliveries (
          id SERIAL PRIMARY KEY,
          owner_user_id TEXT NOT NULL,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
          delivered_to_customer_at TIMESTAMP NOT NULL DEFAULT NOW(),
          delivered_by_user_id TEXT,
          receiver_name TEXT NOT NULL,
          receiver_phone TEXT,
          delivery_note TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS rma_scrap_records (
          id SERIAL PRIMARY KEY,
          owner_user_id TEXT NOT NULL,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          scrap_reason TEXT NOT NULL,
          description TEXT,
          attachment_url TEXT,
          scrapped_by_user_id TEXT,
          scrapped_at TIMESTAMP NOT NULL DEFAULT NOW(),
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((err) => {
      faz3Promise = null;
      throw err;
    });
  }
  return faz3Promise;
}

async function getOwnedPackage(packageId: number, ownerUserId: string) {
  await ensureFaz3Tables();
  const [pkg] = await db
    .select()
    .from(rmaPackages)
    .where(and(eq(rmaPackages.id, packageId), eq(rmaPackages.ownerUserId, ownerUserId)))
    .limit(1);
  return pkg;
}

async function getOwnedTicket(ticketId: number, ownerUserId: string) {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.id, ticketId),
        sql`(${tickets.ownerUserId} = ${ownerUserId} OR ${tickets.ownerUserId} IS NULL)`,
      ),
    )
    .limit(1);
  return ticket;
}

async function getActivePackageItems(packageId: number) {
  return db
    .select()
    .from(rmaPackageItems)
    .where(and(eq(rmaPackageItems.packageId, packageId), isNull(rmaPackageItems.removedAt)));
}

export async function getActiveSupplierResult(productId: number, ownerUserId: string) {
  await ensureFaz3Tables();
  const [result] = await db
    .select()
    .from(rmaSupplierResults)
    .where(
      and(
        eq(rmaSupplierResults.productId, productId),
        eq(rmaSupplierResults.ownerUserId, ownerUserId),
        eq(rmaSupplierResults.isActive, true),
      ),
    )
    .limit(1);
  return result;
}

export async function markDeliveredToSupplier(
  packageId: number,
  ownerUserId: string,
  userId: string,
  input: { deliveryNote?: string },
) {
  const pkg = await getOwnedPackage(packageId, ownerUserId);
  if (!pkg) throw new Error("Koli bulunamadi");
  if (pkg.status !== "sevk_edildi") {
    throw new Error("Sadece sevk edilmis koliler icin tedarikciye ulasildi islemi yapilabilir");
  }

  const now = new Date();
  return db.transaction(async (tx) => {
    await tx
      .update(rmaPackages)
      .set({
        status: "tedarikcide",
        deliveredToSupplierAt: now,
        deliveredByUserId: userId,
        deliveryNote: input.deliveryNote?.trim() || null,
      })
      .where(eq(rmaPackages.id, packageId));

    await tx.insert(rmaPackageHistory).values({
      packageId,
      ownerUserId,
      eventType: "tedarikciye_ulasti",
      performedByUserId: userId,
      notes: input.deliveryNote?.trim(),
    });

    return getPackageDetail(packageId, ownerUserId);
  });
}

export async function markPackageReturned(
  packageId: number,
  ownerUserId: string,
  userId: string,
  input: { returnNote?: string },
) {
  const pkg = await getOwnedPackage(packageId, ownerUserId);
  if (!pkg) throw new Error("Koli bulunamadi");
  if (pkg.status !== "tedarikcide") {
    throw new Error("Sadece tedarikcideki koliler geri dondu olarak isaretlenebilir");
  }

  const items = await getActivePackageItems(packageId);
  const now = new Date();

  return db.transaction(async (tx) => {
    await tx
      .update(rmaPackages)
      .set({
        status: "geri_dondu",
        returnedAt: now,
        returnedByUserId: userId,
        returnNote: input.returnNote?.trim() || null,
      })
      .where(eq(rmaPackages.id, packageId));

    for (const item of items) {
      const product = await getOwnedProduct(item.productId, ownerUserId);
      if (!product) continue;

      await tx
        .update(products)
        .set({ status: "sonuc_bekliyor", warehouseLocation: "rma_deposu" })
        .where(eq(products.id, item.productId));

      await tx.insert(statusHistory).values({
        productId: item.productId,
        status: "sonuc_bekliyor",
        previousStatus: product.status,
        changedByUserId: userId,
        notes: "Tedarikciden geri dondu",
      });

      await tx.insert(rmaProductMovements).values({
        ownerUserId,
        productId: item.productId,
        movementType: "tedarikciden_geri_dondu",
        fromLocation: "tedarikci",
        toLocation: "rma_deposu",
        packageId,
        performedByUserId: userId,
        notes: input.returnNote?.trim(),
      });

      const existing = await tx
        .select()
        .from(rmaSupplierResults)
        .where(
          and(
            eq(rmaSupplierResults.productId, item.productId),
            eq(rmaSupplierResults.isActive, true),
          ),
        )
        .limit(1);

      if (!existing.length) {
        await tx.insert(rmaSupplierResults).values({
          ownerUserId,
          productId: item.productId,
          packageId,
          supplierAccountCode: pkg.supplierAccountCode,
          resultType: "sonuc_bekliyor",
          resultDescription: "Tedarikci sonucu bekleniyor",
          oldSerialNumber: product.serialNumber ?? undefined,
          resultDate: now,
          createdByUserId: userId,
        });
      }
    }

    await tx.insert(rmaPackageHistory).values({
      packageId,
      ownerUserId,
      eventType: "geri_dondu",
      performedByUserId: userId,
      notes: input.returnNote?.trim(),
    });

    return getPackageDetail(packageId, ownerUserId);
  });
}

export type SupplierResultInput = {
  productId: number;
  resultType: string;
  resultDescription?: string;
  supplierDocumentNumber?: string;
  supplierSerialNumber?: string;
  newSerialNumber?: string;
  newBarcode?: string;
  resultDate?: string;
};

function validateResultInput(resultType: string, input: SupplierResultInput, operationType: string) {
  if (!SUPPLIER_RESULT_TYPE_VALUES.includes(resultType as any)) {
    throw new Error(`Gecersiz sonuc tipi: ${resultType}`);
  }
  if (resultType === "sonuc_bekliyor") {
    throw new Error("Sonuc bekliyor otomatik atanir, manuel kaydedilemez");
  }
  if (requiresNewSerial(resultType) && !input.newSerialNumber?.trim()) {
    throw new Error("Bu sonuc tipi icin yeni seri numarasi zorunlu");
  }
  if (operationType === "servis" && resultType === "iade_kabul") {
    throw new Error("Servis urunu icin iade sonucu kullanilamaz");
  }
}

async function upsertSupplierResult(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerUserId: string,
  userId: string,
  packageId: number | null,
  supplierAccountCode: string,
  product: typeof products.$inferSelect,
  ticket: typeof tickets.$inferSelect,
  input: SupplierResultInput,
) {
  const resultType = input.resultType;
  validateResultInput(resultType, input, ticket.operationType || product.category || "servis");

  const now = new Date();
  const resultDate = input.resultDate ? new Date(input.resultDate) : now;

  const [existing] = await tx
    .select()
    .from(rmaSupplierResults)
    .where(and(eq(rmaSupplierResults.productId, product.id), eq(rmaSupplierResults.isActive, true)))
    .limit(1);

  const resultPayload = {
    ownerUserId,
    productId: product.id,
    packageId,
    supplierAccountCode,
    resultType,
    resultDescription: input.resultDescription?.trim(),
    supplierDocumentNumber: input.supplierDocumentNumber?.trim(),
    supplierSerialNumber: input.supplierSerialNumber?.trim(),
    oldSerialNumber: product.serialNumber ?? undefined,
    newSerialNumber: input.newSerialNumber?.trim(),
    newBarcode: input.newBarcode?.trim(),
    resultDate,
    isActive: true,
    createdByUserId: userId,
    updatedAt: now,
  };

  let resultId: number;
  if (existing) {
    await tx
      .update(rmaSupplierResults)
      .set({ isActive: false, updatedAt: now })
      .where(eq(rmaSupplierResults.id, existing.id));

    await tx.insert(rmaSupplierResultHistory).values({
      supplierResultId: existing.id,
      ownerUserId,
      productId: product.id,
      previousResultType: existing.resultType,
      newResultType: resultType,
      snapshot: JSON.stringify(existing),
      changedByUserId: userId,
    });

    const [inserted] = await tx.insert(rmaSupplierResults).values(resultPayload).returning();
    resultId = inserted.id;
  } else {
    const [inserted] = await tx.insert(rmaSupplierResults).values(resultPayload).returning();
    resultId = inserted.id;
  }

  const productUpdates: Partial<typeof products.$inferInsert> = {};
  if (input.newSerialNumber?.trim()) {
    productUpdates.serialNumber = input.newSerialNumber.trim();
  }
  if (input.newBarcode?.trim()) {
    productUpdates.barcode = input.newBarcode.trim();
  }

  const op = ticket.operationType || product.category;
  let newStatus = product.status;

  if (resultType === "reddedildi" || resultType === "iade_red") {
    newStatus = "sonuc_bekliyor";
  } else if (["tamir_edildi", "degistirildi", "urun_yenilendi", "parca_degisti", "iade_kabul"].includes(resultType)) {
    newStatus = "sonuclandi";
  }

  if (newStatus !== product.status) {
    productUpdates.status = newStatus;
    await tx.insert(statusHistory).values({
      productId: product.id,
      status: newStatus,
      previousStatus: product.status,
      changedByUserId: userId,
      notes: `Tedarikci sonucu: ${getSupplierResultLabel(resultType)}`,
    });
  }

  if (Object.keys(productUpdates).length > 0) {
    await tx.update(products).set(productUpdates).where(eq(products.id, product.id));
  }

  await tx.insert(rmaProductMovements).values({
    ownerUserId,
    productId: product.id,
    movementType: "tedarikci_sonucu",
    fromLocation: "tedarikci",
    toLocation: "rma_deposu",
    packageId: packageId ?? undefined,
    performedByUserId: userId,
    notes: getSupplierResultLabel(resultType),
  });

  return { resultId, operationType: op };
}

export async function saveSupplierResult(
  ownerUserId: string,
  userId: string,
  input: SupplierResultInput & { packageId?: number },
) {
  await ensureFaz3Tables();
  const product = await getOwnedProduct(input.productId, ownerUserId);
  if (!product) throw new Error("Urun bulunamadi veya erisim yok");

  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, product.ticketId)).limit(1);
  if (!ticket) throw new Error("Kayit bulunamadi");

  let packageId = input.packageId ?? null;
  let supplierAccountCode = "";

  if (packageId) {
    const pkg = await getOwnedPackage(packageId, ownerUserId);
    if (!pkg) throw new Error("Koli bulunamadi veya erisim yok");
    supplierAccountCode = pkg.supplierAccountCode;
    const items = await getActivePackageItems(packageId);
    if (!items.some((i) => i.productId === input.productId)) {
      throw new Error("Urun bu kolide degil");
    }
  } else {
    const [item] = await db
      .select({ pkg: rmaPackages })
      .from(rmaPackageItems)
      .innerJoin(rmaPackages, eq(rmaPackageItems.packageId, rmaPackages.id))
      .where(
        and(
          eq(rmaPackageItems.productId, input.productId),
          isNull(rmaPackageItems.removedAt),
          eq(rmaPackages.ownerUserId, ownerUserId),
        ),
      )
      .limit(1);
    if (item) {
      packageId = item.pkg.id;
      supplierAccountCode = item.pkg.supplierAccountCode;
    } else {
      throw new Error("Urun aktif koli ile iliskili degil");
    }
  }

  return db.transaction(async (tx) => {
    await upsertSupplierResult(tx, ownerUserId, userId, packageId, supplierAccountCode, product, ticket, input);
    if (packageId) return getPackageDetail(packageId, ownerUserId);
    return getActiveSupplierResult(input.productId, ownerUserId);
  });
}

export async function bulkSaveSupplierResults(
  ownerUserId: string,
  userId: string,
  packageId: number,
  input: {
    productIds: number[];
    resultType: string;
    resultDescription?: string;
    items?: Array<{ productId: number; newSerialNumber?: string; newBarcode?: string }>;
  },
) {
  const pkg = await getOwnedPackage(packageId, ownerUserId);
  if (!pkg) throw new Error("Koli bulunamadi");
  if (pkg.status !== "geri_dondu") {
    throw new Error("Toplu sonuc sadece geri donmus koliler icin kullanilabilir");
  }

  const activeItems = await getActivePackageItems(packageId);
  const activeProductIds = new Set(activeItems.map((i) => i.productId));

  for (const pid of input.productIds) {
    if (!activeProductIds.has(pid)) {
      throw new Error(`Urun ${pid} bu kolide aktif degil`);
    }
  }

  const itemOverrides = new Map((input.items ?? []).map((i) => [i.productId, i]));

  return db.transaction(async (tx) => {
    for (const productId of input.productIds) {
      const product = await getOwnedProduct(productId, ownerUserId);
      if (!product) throw new Error(`Urun ${productId} bulunamadi`);

      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, product.ticketId)).limit(1);
      if (!ticket) throw new Error("Kayit bulunamadi");

      const override = itemOverrides.get(productId);
      await upsertSupplierResult(tx, ownerUserId, userId, packageId, pkg.supplierAccountCode, product, ticket, {
        productId,
        resultType: input.resultType,
        resultDescription: input.resultDescription,
        newSerialNumber: override?.newSerialNumber,
        newBarcode: override?.newBarcode,
      });
    }
    return getPackageDetail(packageId, ownerUserId);
  });
}

export async function moveToSellableStock(productId: number, ownerUserId: string, userId: string, notes?: string) {
  await ensureFaz3Tables();
  const product = await getOwnedProduct(productId, ownerUserId);
  if (!product) throw new Error("Urun bulunamadi veya erisim yok");

  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, product.ticketId)).limit(1);
  const op = ticket?.operationType || product.category;
  if (op === "servis") {
    throw new Error("Servis urunu satilabilir stoga alinamaz");
  }

  const result = await getActiveSupplierResult(productId, ownerUserId);
  if (op === "degisim" && result && !["degistirildi", "urun_yenilendi", "parca_degisti"].includes(result.resultType)) {
    throw new Error("Degisim urunu icin once degistirildi sonucu girilmeli");
  }

  return db.transaction(async (tx) => {
    const prevStatus = product.status;
    await tx
      .update(products)
      .set({ status: "satilabilir_stok", warehouseLocation: "satilabilir_stok" })
      .where(eq(products.id, productId));

    await tx.insert(statusHistory).values({
      productId,
      status: "satilabilir_stok",
      previousStatus: prevStatus,
      changedByUserId: userId,
      notes: notes || "Satilabilir stoga alindi",
    });

    await tx.insert(rmaProductMovements).values({
      ownerUserId,
      productId,
      movementType: "satilabilir_stoga_alindi",
      fromLocation: product.warehouseLocation || "rma_deposu",
      toLocation: "satilabilir_stok",
      performedByUserId: userId,
      notes,
    });

    return tx.select().from(products).where(eq(products.id, productId)).limit(1).then((r) => r[0]);
  });
}

export async function markProductScrap(
  productId: number,
  ownerUserId: string,
  userId: string,
  input: { scrapReason: string; description?: string; attachmentUrl?: string },
) {
  await ensureFaz3Tables();
  const product = await getOwnedProduct(productId, ownerUserId);
  if (!product) throw new Error("Urun bulunamadi veya erisim yok");
  if (!input.scrapReason?.trim()) throw new Error("Hurda nedeni zorunlu");

  return db.transaction(async (tx) => {
    const prevStatus = product.status;
    await tx
      .update(products)
      .set({ status: "hurda", warehouseLocation: "hurda" })
      .where(eq(products.id, productId));

    await tx.insert(statusHistory).values({
      productId,
      status: "hurda",
      previousStatus: prevStatus,
      changedByUserId: userId,
      notes: input.scrapReason.trim(),
    });

    await tx.insert(rmaScrapRecords).values({
      ownerUserId,
      productId,
      scrapReason: input.scrapReason.trim(),
      description: input.description?.trim(),
      attachmentUrl: input.attachmentUrl?.trim(),
      scrappedByUserId: userId,
    });

    await tx.insert(rmaProductMovements).values({
      ownerUserId,
      productId,
      movementType: "hurdaya_ayrildi",
      fromLocation: product.warehouseLocation || "rma_deposu",
      toLocation: "hurda",
      performedByUserId: userId,
      notes: input.scrapReason.trim(),
    });

    return tx.select().from(products).where(eq(products.id, productId)).limit(1).then((r) => r[0]);
  });
}

export async function deliverToCustomer(
  productId: number,
  ownerUserId: string,
  userId: string,
  input: { receiverName: string; receiverPhone?: string; deliveryNote?: string },
) {
  await ensureFaz3Tables();
  const product = await getOwnedProduct(productId, ownerUserId);
  if (!product) throw new Error("Urun bulunamadi veya erisim yok");

  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, product.ticketId)).limit(1);
  const op = ticket?.operationType || product.category;
  if (op !== "servis") throw new Error("Musteriye teslim sadece servis urunleri icin gecerlidir");
  if (!input.receiverName?.trim()) throw new Error("Teslim alan adi zorunlu");

  const result = await getActiveSupplierResult(productId, ownerUserId);
  if (result && !["tamir_edildi", "degistirildi", "urun_yenilendi", "parca_degisti"].includes(result.resultType)) {
    throw new Error("Servis urunu icin uygun tedarikci sonucu girilmeli");
  }

  const existingDelivery = await db
    .select()
    .from(rmaCustomerDeliveries)
    .where(and(eq(rmaCustomerDeliveries.productId, productId), eq(rmaCustomerDeliveries.ownerUserId, ownerUserId)))
    .limit(1);
  if (existingDelivery.length) throw new Error("Urun zaten musteriye teslim edilmis");

  const now = new Date();
  return db.transaction(async (tx) => {
    const prevStatus = product.status;
    await tx
      .update(products)
      .set({ status: "musteriye_teslim_edildi", warehouseLocation: "musteri" })
      .where(eq(products.id, productId));

    await tx.insert(statusHistory).values({
      productId,
      status: "musteriye_teslim_edildi",
      previousStatus: prevStatus,
      changedByUserId: userId,
      notes: input.deliveryNote?.trim() || `Teslim alan: ${input.receiverName.trim()}`,
    });

    await tx.insert(rmaCustomerDeliveries).values({
      ownerUserId,
      productId,
      ticketId: product.ticketId,
      deliveredToCustomerAt: now,
      deliveredByUserId: userId,
      receiverName: input.receiverName.trim(),
      receiverPhone: input.receiverPhone?.trim(),
      deliveryNote: input.deliveryNote?.trim(),
    });

    await tx.insert(rmaProductMovements).values({
      ownerUserId,
      productId,
      movementType: "musteriye_teslim",
      fromLocation: product.warehouseLocation || "rma_deposu",
      toLocation: "musteri",
      performedByUserId: userId,
      notes: input.receiverName.trim(),
    });

    return tx.select().from(products).where(eq(products.id, productId)).limit(1).then((r) => r[0]);
  });
}

export async function validatePackageCompletion(packageId: number, ownerUserId: string) {
  await ensureFaz3Tables();
  const items = await getActivePackageItems(packageId);
  const errors: string[] = [];

  for (const item of items) {
    const result = await getActiveSupplierResult(item.productId, ownerUserId);
    if (!result || result.resultType === "sonuc_bekliyor") {
      const product = await getOwnedProduct(item.productId, ownerUserId);
      errors.push(`${product?.name || item.productId}: tedarikci sonucu bekliyor`);
      continue;
    }
    if (requiresNewSerial(result.resultType) && !result.newSerialNumber?.trim()) {
      errors.push(`${item.productId}: yeni seri numarasi eksik`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function completePackage(packageId: number, ownerUserId: string, userId: string) {
  const pkg = await getOwnedPackage(packageId, ownerUserId);
  if (!pkg) throw new Error("Koli bulunamadi");
  if (pkg.status !== "geri_dondu") {
    throw new Error("Sadece geri donmus koliler tamamlanabilir");
  }

  const validation = await validatePackageCompletion(packageId, ownerUserId);
  if (!validation.ok) {
    throw new Error(validation.errors.join("; "));
  }

  const now = new Date();
  return db.transaction(async (tx) => {
    await tx
      .update(rmaPackages)
      .set({ status: "tamamlandi", completedAt: now })
      .where(eq(rmaPackages.id, packageId));

    await tx.insert(rmaPackageHistory).values({
      packageId,
      ownerUserId,
      eventType: "tamamlandi",
      performedByUserId: userId,
    });

    return getPackageDetail(packageId, ownerUserId);
  });
}

export async function enrichPackageWithResults(packageId: number, ownerUserId: string) {
  await ensureFaz3Tables();
  const detail = await getPackageDetail(packageId, ownerUserId);
  if (!detail) return undefined;

  const itemsWithResults = [];
  for (const item of detail.items ?? []) {
    const result = await getActiveSupplierResult(item.productId, ownerUserId);
    const delivery = await db
      .select()
      .from(rmaCustomerDeliveries)
      .where(
        and(
          eq(rmaCustomerDeliveries.productId, item.productId),
          eq(rmaCustomerDeliveries.ownerUserId, ownerUserId),
        ),
      )
      .limit(1);
    itemsWithResults.push({
      ...item,
      supplierResult: result ?? null,
      customerDelivery: delivery[0] ?? null,
    });
  }

  const validation = await validatePackageCompletion(packageId, ownerUserId);
  return { ...detail, items: itemsWithResults, completionValidation: validation };
}

export async function getProductTimeline(productId: number, ownerUserId: string) {
  await ensureFaz3Tables();
  const product = await getOwnedProduct(productId, ownerUserId);
  if (!product) return [];

  const events: Array<{
    at: Date;
    type: string;
    label: string;
    performedByUserId?: string | null;
    notes?: string | null;
  }> = [];

  const history = await db
    .select()
    .from(statusHistory)
    .where(eq(statusHistory.productId, productId))
    .orderBy(desc(statusHistory.createdAt));

  for (const h of history) {
    events.push({
      at: h.createdAt,
      type: "status",
      label: h.status,
      performedByUserId: h.changedByUserId,
      notes: h.notes,
    });
  }

  const movements = await db
    .select()
    .from(rmaProductMovements)
    .where(
      and(eq(rmaProductMovements.productId, productId), eq(rmaProductMovements.ownerUserId, ownerUserId)),
    )
    .orderBy(desc(rmaProductMovements.createdAt));

  for (const m of movements) {
    events.push({
      at: m.createdAt,
      type: "movement",
      label: m.movementType,
      performedByUserId: m.performedByUserId,
      notes: m.notes,
    });
  }

  const results = await db
    .select()
    .from(rmaSupplierResults)
    .where(and(eq(rmaSupplierResults.productId, productId), eq(rmaSupplierResults.ownerUserId, ownerUserId)))
    .orderBy(desc(rmaSupplierResults.createdAt));

  for (const r of results) {
    events.push({
      at: r.resultDate,
      type: "supplier_result",
      label: r.resultType,
      performedByUserId: r.createdByUserId,
      notes: r.resultDescription,
    });
  }

  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  return events;
}

export async function getFaz3Metrics(ownerUserId: string) {
  await ensureFaz3Tables();
  const ownerFilter = sql`${products.ticketId} IN (SELECT id FROM tickets WHERE owner_user_id = ${ownerUserId} OR owner_user_id IS NULL)`;

  const [atSupplier] = await db
    .select({ count: count() })
    .from(products)
    .where(and(ownerFilter, eq(products.status, "tedarikcide")));

  const [awaitingResult] = await db
    .select({ count: count() })
    .from(products)
    .where(and(ownerFilter, eq(products.status, "sonuc_bekliyor")));

  const resultCounts = await db
    .select({ resultType: rmaSupplierResults.resultType, count: count() })
    .from(rmaSupplierResults)
    .where(and(eq(rmaSupplierResults.ownerUserId, ownerUserId), eq(rmaSupplierResults.isActive, true)))
    .groupBy(rmaSupplierResults.resultType);

  const byResult: Record<string, number> = {};
  for (const row of resultCounts) {
    byResult[row.resultType] = Number(row.count);
  }

  const [scrapCount] = await db
    .select({ count: count() })
    .from(products)
    .where(and(ownerFilter, eq(products.status, "hurda")));

  const [sellableCount] = await db
    .select({ count: count() })
    .from(products)
    .where(and(ownerFilter, eq(products.status, "satilabilir_stok")));

  const [customerPending] = await db
    .select({ count: count() })
    .from(products)
    .innerJoin(tickets, eq(products.ticketId, tickets.id))
    .where(
      and(
        ownerFilter,
        eq(tickets.operationType, "servis"),
        inArray(products.status, ["sonuclandi", "tamir_edildi"]),
      ),
    );

  const [closedRma] = await db
    .select({ count: count() })
    .from(tickets)
    .where(and(sql`(${tickets.ownerUserId} = ${ownerUserId} OR ${tickets.ownerUserId} IS NULL)`, eq(tickets.rmaStatus, "closed")));

  const supplierBreakdown = await db
    .select({
      supplierAccountCode: rmaSupplierResults.supplierAccountCode,
      resultType: rmaSupplierResults.resultType,
      count: count(),
    })
    .from(rmaSupplierResults)
    .where(and(eq(rmaSupplierResults.ownerUserId, ownerUserId), eq(rmaSupplierResults.isActive, true)))
    .groupBy(rmaSupplierResults.supplierAccountCode, rmaSupplierResults.resultType);

  const bySupplier: Record<string, Record<string, number>> = {};
  for (const row of supplierBreakdown) {
    if (!bySupplier[row.supplierAccountCode]) bySupplier[row.supplierAccountCode] = {};
    bySupplier[row.supplierAccountCode][row.resultType] = Number(row.count);
  }

  return {
    atSupplier: Number(atSupplier?.count || 0),
    awaitingResult: Number(awaitingResult?.count || 0),
    replaced: byResult.degistirildi || 0,
    repaired: byResult.tamir_edildi || 0,
    rejected: byResult.reddedildi || 0,
    scrapped: Number(scrapCount?.count || 0),
    sellableStock: Number(sellableCount?.count || 0),
    customerDeliveryPending: Number(customerPending?.count || 0),
    completedRma: Number(closedRma?.count || 0),
    byResult,
    bySupplier,
  };
}

export { getOwnedTicket };
