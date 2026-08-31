import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  products,
  rmaPackageHistory,
  rmaPackageItems,
  rmaPackages,
  rmaProductMovements,
  rmaShipments,
  statusHistory,
  supplierItems,
  tickets,
} from "@shared/schema";
import { EDITABLE_PACKAGE_STATUSES } from "@shared/package-constants";
import { RMA_DEFAULT_WAREHOUSE_LOCATION } from "@shared/rma-constants";
import { db } from "./db";
import { getOwnedProduct } from "./suppliers";

let schemaPromise: Promise<void> | null = null;

const PREP_STATUSES = ["rma_deposunda", "tedarikci_bekliyor", "beklemede"];

export function ensurePackageTables() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS rma_packages (
          id SERIAL PRIMARY KEY,
          owner_user_id TEXT NOT NULL,
          package_number TEXT NOT NULL,
          supplier_account_code TEXT NOT NULL,
          supplier_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'taslak',
          barcode_value TEXT,
          qr_value TEXT,
          created_by_user_id TEXT,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          closed_at TIMESTAMP,
          verified_at TIMESTAMP,
          shipped_at TIMESTAMP,
          UNIQUE (owner_user_id, package_number)
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS rma_package_items (
          id SERIAL PRIMARY KEY,
          package_id INTEGER NOT NULL REFERENCES rma_packages(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          quantity INTEGER NOT NULL DEFAULT 1,
          added_by_user_id TEXT,
          added_at TIMESTAMP NOT NULL DEFAULT NOW(),
          removed_at TIMESTAMP
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS rma_package_items_active_product_unique
        ON rma_package_items (product_id) WHERE removed_at IS NULL
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS rma_shipments (
          id SERIAL PRIMARY KEY,
          owner_user_id TEXT NOT NULL,
          package_id INTEGER NOT NULL REFERENCES rma_packages(id) ON DELETE CASCADE,
          supplier_account_code TEXT NOT NULL,
          supplier_name TEXT NOT NULL,
          shipment_number TEXT NOT NULL,
          carrier_name TEXT,
          tracking_number TEXT,
          shipped_by_user_id TEXT,
          shipped_at TIMESTAMP NOT NULL DEFAULT NOW(),
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'sevk_edildi',
          UNIQUE (owner_user_id, shipment_number)
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS rma_product_movements (
          id SERIAL PRIMARY KEY,
          owner_user_id TEXT NOT NULL,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          movement_type TEXT NOT NULL,
          from_location TEXT,
          to_location TEXT,
          package_id INTEGER REFERENCES rma_packages(id) ON DELETE SET NULL,
          shipment_id INTEGER REFERENCES rma_shipments(id) ON DELETE SET NULL,
          performed_by_user_id TEXT,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS rma_package_history (
          id SERIAL PRIMARY KEY,
          package_id INTEGER NOT NULL REFERENCES rma_packages(id) ON DELETE CASCADE,
          owner_user_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          performed_by_user_id TEXT,
          notes TEXT,
          metadata TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

async function getOwnedPackage(packageId: number, ownerUserId: string) {
  await ensurePackageTables();
  const [pkg] = await db
    .select()
    .from(rmaPackages)
    .where(and(eq(rmaPackages.id, packageId), eq(rmaPackages.ownerUserId, ownerUserId)))
    .limit(1);
  return pkg;
}

async function recordPackageHistory(
  packageId: number,
  ownerUserId: string,
  eventType: string,
  performedByUserId?: string,
  notes?: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(rmaPackageHistory).values({
    packageId,
    ownerUserId,
    eventType,
    performedByUserId,
    notes,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });
}

async function recordMovement(input: {
  ownerUserId: string;
  productId: number;
  movementType: string;
  fromLocation?: string;
  toLocation?: string;
  packageId?: number;
  shipmentId?: number;
  performedByUserId?: string;
  notes?: string;
}) {
  await db.insert(rmaProductMovements).values(input);
}

async function generatePackageNumber(ownerUserId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RMA-KOLI-${year}-`;
  const [row] = await db
    .select({ count: count() })
    .from(rmaPackages)
    .where(and(eq(rmaPackages.ownerUserId, ownerUserId), ilike(rmaPackages.packageNumber, `${prefix}%`)));
  const seq = (Number(row?.count || 0) + 1).toString().padStart(6, "0");
  return `${prefix}${seq}`;
}

async function generateShipmentNumber(ownerUserId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RMA-SEVK-${year}-`;
  const [row] = await db
    .select({ count: count() })
    .from(rmaShipments)
    .where(and(eq(rmaShipments.ownerUserId, ownerUserId), ilike(rmaShipments.shipmentNumber, `${prefix}%`)));
  const seq = (Number(row?.count || 0) + 1).toString().padStart(6, "0");
  return `${prefix}${seq}`;
}

async function getActivePackageItemForProduct(productId: number) {
  const [item] = await db
    .select()
    .from(rmaPackageItems)
    .where(and(eq(rmaPackageItems.productId, productId), isNull(rmaPackageItems.removedAt)))
    .limit(1);
  return item;
}

async function loadProductContext(productId: number, ownerUserId: string) {
  const product = await getOwnedProduct(productId, ownerUserId);
  if (!product) return null;

  const [supplier] = await db
    .select()
    .from(supplierItems)
    .where(and(eq(supplierItems.productId, productId), eq(supplierItems.ownerUserId, ownerUserId)))
    .limit(1);

  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, product.ticketId)).limit(1);

  return { product, supplier, ticket };
}

async function validateProductsForPackage(
  productIds: number[],
  ownerUserId: string,
  supplierAccountCode: string,
  excludePackageId?: number,
) {
  const contexts = [];
  for (const productId of productIds) {
    const ctx = await loadProductContext(productId, ownerUserId);
    if (!ctx) throw new Error(`Urun bulunamadi veya erisim yok: ${productId}`);

    if (!ctx.supplier) throw new Error(`Urun ${productId} icin tedarikci atanmamis`);
    if (ctx.supplier.supplierAccountCode !== supplierAccountCode) {
      throw new Error(`Urun ${productId} farkli tedarikciye ait`);
    }

    const activeItem = await getActivePackageItemForProduct(productId);
    if (activeItem && activeItem.packageId !== excludePackageId) {
      throw new Error(`Urun ${productId} baska bir aktif kolide`);
    }

    const wh = ctx.product.warehouseLocation || RMA_DEFAULT_WAREHOUSE_LOCATION;
    if (wh !== RMA_DEFAULT_WAREHOUSE_LOCATION) {
      throw new Error(`Urun ${productId} RMA deposunda degil`);
    }

    const allowedOnClose = excludePackageId
      ? [...PREP_STATUSES, "tedarikciye_hazir"]
      : PREP_STATUSES;
    if (!allowedOnClose.includes(ctx.product.status)) {
      throw new Error(`Urun ${productId} durumu koliye uygun degil: ${ctx.product.status}`);
    }

    contexts.push(ctx);
  }
  return contexts;
}

export async function getSupplierPrepPool(ownerUserId: string) {
  await ensurePackageTables();

  const rows = await db
    .select({
      product: products,
      supplier: supplierItems,
      ticket: tickets,
    })
    .from(products)
    .innerJoin(tickets, eq(products.ticketId, tickets.id))
    .innerJoin(
      supplierItems,
      and(eq(supplierItems.productId, products.id), eq(supplierItems.ownerUserId, ownerUserId)),
    )
    .where(
      and(
        or(eq(tickets.ownerUserId, ownerUserId), isNull(tickets.ownerUserId)),
        eq(products.warehouseLocation, RMA_DEFAULT_WAREHOUSE_LOCATION),
        inArray(products.status, PREP_STATUSES),
      ),
    )
    .orderBy(desc(products.createdAt));

  const available = [];
  for (const row of rows) {
    const active = await getActivePackageItemForProduct(row.product.id);
    if (!active) available.push(row);
  }

  const grouped = new Map<
    string,
    {
      supplierAccountCode: string;
      supplierName: string;
      totalQuantity: number;
      ticketIds: Set<number>;
      products: Array<{
        product: typeof products.$inferSelect;
        ticket: typeof tickets.$inferSelect;
        supplier: typeof supplierItems.$inferSelect;
      }>;
    }
  >();

  for (const row of available) {
    const key = row.supplier.supplierAccountCode;
    if (!grouped.has(key)) {
      grouped.set(key, {
        supplierAccountCode: row.supplier.supplierAccountCode,
        supplierName: row.supplier.supplierName,
        totalQuantity: 0,
        ticketIds: new Set(),
        products: [],
      });
    }
    const group = grouped.get(key)!;
    group.totalQuantity += row.product.quantity ?? 1;
    group.ticketIds.add(row.ticket.id);
    group.products.push(row);
  }

  return Array.from(grouped.values()).map((g) => ({
    ...g,
    ticketCount: g.ticketIds.size,
    ticketIds: undefined,
  }));
}

export async function getPackageDetail(packageId: number, ownerUserId: string) {
  await ensurePackageTables();
  const pkg = await getOwnedPackage(packageId, ownerUserId);
  if (!pkg) return undefined;

  const items = await db.query.rmaPackageItems.findMany({
    where: and(eq(rmaPackageItems.packageId, packageId), isNull(rmaPackageItems.removedAt)),
    with: {
      product: {
        with: {
          ticket: true,
          supplierItems: true,
        },
      },
    },
    orderBy: [desc(rmaPackageItems.addedAt)],
  });

  const history = await db
    .select()
    .from(rmaPackageHistory)
    .where(eq(rmaPackageHistory.packageId, packageId))
    .orderBy(desc(rmaPackageHistory.createdAt));

  const [shipment] = await db
    .select()
    .from(rmaShipments)
    .where(eq(rmaShipments.packageId, packageId))
    .orderBy(desc(rmaShipments.shippedAt))
    .limit(1);

  const totalQuantity = items.reduce((sum, i) => sum + (i.quantity ?? 1), 0);

  return { ...pkg, items, history, shipment, totalQuantity, productCount: items.length };
}

export async function listPackages(
  ownerUserId: string,
  filters?: {
    status?: string;
    supplier?: string;
    search?: string;
    barcode?: string;
  },
) {
  await ensurePackageTables();
  const conditions = [eq(rmaPackages.ownerUserId, ownerUserId)];

  if (filters?.status) conditions.push(eq(rmaPackages.status, filters.status));
  if (filters?.supplier) {
    conditions.push(
      or(
        ilike(rmaPackages.supplierAccountCode, `%${filters.supplier}%`),
        ilike(rmaPackages.supplierName, `%${filters.supplier}%`),
      )!,
    );
  }
  if (filters?.barcode) {
    conditions.push(
      or(
        eq(rmaPackages.barcodeValue, filters.barcode),
        eq(rmaPackages.qrValue, filters.barcode),
        eq(rmaPackages.packageNumber, filters.barcode),
      )!,
    );
  }

  let packageIds: number[] | undefined;
  if (filters?.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    const matchedByPackage = await db
      .select({ id: rmaPackages.id })
      .from(rmaPackages)
      .where(
        and(
          eq(rmaPackages.ownerUserId, ownerUserId),
          or(
            ilike(rmaPackages.packageNumber, q),
            ilike(rmaPackages.barcodeValue, q),
            ilike(rmaPackages.qrValue, q),
            ilike(rmaPackages.supplierAccountCode, q),
            ilike(rmaPackages.supplierName, q),
          )!,
        ),
      );

    const matchedByProduct = await db
      .select({ id: rmaPackages.id })
      .from(rmaPackages)
      .innerJoin(rmaPackageItems, eq(rmaPackageItems.packageId, rmaPackages.id))
      .innerJoin(products, eq(rmaPackageItems.productId, products.id))
      .innerJoin(tickets, eq(products.ticketId, tickets.id))
      .where(
        and(
          eq(rmaPackages.ownerUserId, ownerUserId),
          isNull(rmaPackageItems.removedAt),
          or(
            ilike(products.name, q),
            ilike(products.stockCode, q),
            ilike(products.barcode, q),
            ilike(products.serialNumber, q),
            ilike(tickets.receiptNumber, q),
          )!,
        ),
      );

    packageIds = [...new Set([...matchedByPackage, ...matchedByProduct].map((r) => r.id))];
    if (packageIds.length === 0) return [];
    conditions.push(inArray(rmaPackages.id, packageIds));
  } else if (filters?.search) {
    conditions.push(ilike(rmaPackages.packageNumber, `%${filters.search}%`));
  }

  const packages = await db
    .select()
    .from(rmaPackages)
    .where(and(...conditions))
    .orderBy(desc(rmaPackages.createdAt));

  const enriched = [];
  for (const pkg of packages) {
    const detail = await getPackageDetail(pkg.id, ownerUserId);
    enriched.push(detail);
  }
  return enriched;
}

export async function getPackageMetrics(ownerUserId: string) {
  await ensurePackageTables();
  const rows = await db
    .select({ status: rmaPackages.status, count: count() })
    .from(rmaPackages)
    .where(eq(rmaPackages.ownerUserId, ownerUserId))
    .groupBy(rmaPackages.status);

  const metrics = {
    hazirlanan: 0,
    dogrulamaBekleyen: 0,
    sevkeHazir: 0,
    tedarikcide: 0,
    tamamlanan: 0,
  };

  for (const row of rows) {
    const c = Number(row.count);
    if (["taslak", "hazirlaniyor"].includes(row.status)) metrics.hazirlanan += c;
    if (row.status === "kapatildi") metrics.dogrulamaBekleyen += c;
    if (row.status === "sevke_hazir") metrics.sevkeHazir += c;
    if (["sevk_edildi", "tedarikcide"].includes(row.status)) metrics.tedarikcide += c;
    if (["tamamlandi", "geri_dondu"].includes(row.status)) metrics.tamamlanan += c;
  }

  return metrics;
}

export async function createPackageFromProducts(
  ownerUserId: string,
  userId: string,
  input: {
    supplierAccountCode: string;
    supplierName: string;
    productIds: number[];
    notes?: string;
  },
) {
  await ensurePackageTables();
  if (input.productIds.length === 0) throw new Error("En az bir urun secilmeli");

  await validateProductsForPackage(input.productIds, ownerUserId, input.supplierAccountCode);

  return db.transaction(async (tx) => {
    const packageNumber = await generatePackageNumber(ownerUserId);
    const [pkg] = await tx
      .insert(rmaPackages)
      .values({
        ownerUserId,
        packageNumber,
        supplierAccountCode: input.supplierAccountCode.trim(),
        supplierName: input.supplierName.trim(),
        status: "hazirlaniyor",
        createdByUserId: userId,
        notes: input.notes?.trim(),
      })
      .returning();

    for (const productId of input.productIds) {
      const ctx = await loadProductContext(productId, ownerUserId);
      if (!ctx) throw new Error(`Urun ${productId} bulunamadi`);

      await tx.insert(rmaPackageItems).values({
        packageId: pkg.id,
        productId,
        quantity: ctx.product.quantity ?? 1,
        addedByUserId: userId,
      });

      await tx.insert(rmaProductMovements).values({
        ownerUserId,
        productId,
        movementType: "koliye_eklendi",
        fromLocation: RMA_DEFAULT_WAREHOUSE_LOCATION,
        toLocation: `koli:${pkg.packageNumber}`,
        packageId: pkg.id,
        performedByUserId: userId,
      });
    }

    await tx.insert(rmaPackageHistory).values({
      packageId: pkg.id,
      ownerUserId,
      eventType: "olusturuldu",
      performedByUserId: userId,
      notes: `${input.productIds.length} urun ile olusturuldu`,
    });

    return pkg.id;
  }).then((packageId) => getPackageDetail(packageId, ownerUserId));
}

export async function addProductsToPackage(
  packageId: number,
  ownerUserId: string,
  userId: string,
  productIds: number[],
) {
  const pkg = await getOwnedPackage(packageId, ownerUserId);
  if (!pkg) throw new Error("Koli bulunamadi");
  if (!EDITABLE_PACKAGE_STATUSES.includes(pkg.status as any)) {
    throw new Error("Kapali koli degistirilemez");
  }

  await validateProductsForPackage(productIds, ownerUserId, pkg.supplierAccountCode);

  return db.transaction(async (tx) => {
    for (const productId of productIds) {
      const ctx = await loadProductContext(productId, ownerUserId);
      if (!ctx) throw new Error(`Urun ${productId} bulunamadi`);

      await tx.insert(rmaPackageItems).values({
        packageId,
        productId,
        quantity: ctx.product.quantity ?? 1,
        addedByUserId: userId,
      });

      await tx.insert(rmaProductMovements).values({
        ownerUserId,
        productId,
        movementType: "koliye_eklendi",
        fromLocation: RMA_DEFAULT_WAREHOUSE_LOCATION,
        toLocation: `koli:${pkg.packageNumber}`,
        packageId,
        performedByUserId: userId,
      });

      await tx.insert(rmaPackageHistory).values({
        packageId,
        ownerUserId,
        eventType: "urun_eklendi",
        performedByUserId: userId,
        notes: `Urun #${productId} eklendi`,
      });
    }

    if (pkg.status === "taslak") {
      await tx.update(rmaPackages).set({ status: "hazirlaniyor" }).where(eq(rmaPackages.id, packageId));
    }

    return getPackageDetail(packageId, ownerUserId);
  });
}

export async function removeProductFromPackage(
  packageId: number,
  itemId: number,
  ownerUserId: string,
  userId: string,
) {
  const pkg = await getOwnedPackage(packageId, ownerUserId);
  if (!pkg) throw new Error("Koli bulunamadi");
  if (!EDITABLE_PACKAGE_STATUSES.includes(pkg.status as any)) {
    throw new Error("Kapali koli degistirilemez");
  }

  const [item] = await db
    .select()
    .from(rmaPackageItems)
    .where(
      and(
        eq(rmaPackageItems.id, itemId),
        eq(rmaPackageItems.packageId, packageId),
        isNull(rmaPackageItems.removedAt),
      ),
    )
    .limit(1);

  if (!item) throw new Error("Koli urunu bulunamadi");

  return db.transaction(async (tx) => {
    await tx
      .update(rmaPackageItems)
      .set({ removedAt: new Date() })
      .where(eq(rmaPackageItems.id, itemId));

    await tx.insert(rmaProductMovements).values({
      ownerUserId,
      productId: item.productId,
      movementType: "koliden_cikarildi",
      fromLocation: `koli:${pkg.packageNumber}`,
      toLocation: RMA_DEFAULT_WAREHOUSE_LOCATION,
      packageId,
      performedByUserId: userId,
    });

    await tx.insert(rmaPackageHistory).values({
      packageId,
      ownerUserId,
      eventType: "urun_cikarildi",
      performedByUserId: userId,
      notes: `Urun #${item.productId} cikarildi`,
    });

    return getPackageDetail(packageId, ownerUserId);
  });
}

export async function closePackage(packageId: number, ownerUserId: string, userId: string) {
  const pkg = await getOwnedPackage(packageId, ownerUserId);
  if (!pkg) throw new Error("Koli bulunamadi");
  if (!EDITABLE_PACKAGE_STATUSES.includes(pkg.status as any)) {
    throw new Error("Koli zaten kapatilmis");
  }

  const items = await db
    .select()
    .from(rmaPackageItems)
    .where(and(eq(rmaPackageItems.packageId, packageId), isNull(rmaPackageItems.removedAt)));

  if (items.length === 0) throw new Error("Kolide en az bir urun olmali");

  for (const item of items) {
    await validateProductsForPackage([item.productId], ownerUserId, pkg.supplierAccountCode, packageId);
  }

  const scanToken = `RMAPKG-${packageId}-${nanoid(10)}`;
  const now = new Date();

  return db.transaction(async (tx) => {
    await tx
      .update(rmaPackages)
      .set({
        status: "kapatildi",
        closedAt: now,
        barcodeValue: scanToken,
        qrValue: scanToken,
      })
      .where(eq(rmaPackages.id, packageId));

    for (const item of items) {
      const product = await getOwnedProduct(item.productId, ownerUserId);
      if (!product) continue;

      await tx
        .update(products)
        .set({ status: "tedarikciye_hazir" })
        .where(eq(products.id, item.productId));

      await tx.insert(statusHistory).values({
        productId: item.productId,
        status: "tedarikciye_hazir",
        previousStatus: product.status,
        changedByUserId: userId,
        notes: `Koli ${pkg.packageNumber} kapatildi`,
      });
    }

    await tx.insert(rmaPackageHistory).values({
      packageId,
      ownerUserId,
      eventType: "kapatildi",
      performedByUserId: userId,
      notes: "Koli kapatildi ve barkod uretildi",
    });

    return getPackageDetail(packageId, ownerUserId);
  });
}

export async function verifyPackageBarcode(
  scannedValue: string,
  ownerUserId: string,
  userId: string,
) {
  await ensurePackageTables();
  const value = scannedValue.trim();
  if (!value) throw new Error("Barkod degeri bos");

  const [pkg] = await db
    .select()
    .from(rmaPackages)
    .where(
      and(
        eq(rmaPackages.ownerUserId, ownerUserId),
        or(eq(rmaPackages.barcodeValue, value), eq(rmaPackages.qrValue, value))!,
      ),
    )
    .limit(1);

  if (!pkg) throw new Error("Barkod eslesmedi");
  if (pkg.status !== "kapatildi") throw new Error("Koli dogrulama icin kapatilmis olmali");

  const now = new Date();

  return db.transaction(async (tx) => {
    await tx
      .update(rmaPackages)
      .set({ status: "sevke_hazir", verifiedAt: now })
      .where(eq(rmaPackages.id, pkg.id));

    await tx.insert(rmaPackageHistory).values({
      packageId: pkg.id,
      ownerUserId,
      eventType: "barkod_dogrulandi",
      performedByUserId: userId,
    });

    await tx.insert(rmaPackageHistory).values({
      packageId: pkg.id,
      ownerUserId,
      eventType: "sevke_hazirlandi",
      performedByUserId: userId,
    });

    return getPackageDetail(pkg.id, ownerUserId);
  });
}

export async function shipPackage(
  packageId: number,
  ownerUserId: string,
  userId: string,
  input: { carrierName?: string; trackingNumber?: string; notes?: string },
) {
  const pkg = await getOwnedPackage(packageId, ownerUserId);
  if (!pkg) throw new Error("Koli bulunamadi");
  if (pkg.status !== "sevke_hazir") {
    throw new Error("Koli sevk icin dogrulanmis ve sevke hazir olmali");
  }

  const items = await db
    .select()
    .from(rmaPackageItems)
    .where(and(eq(rmaPackageItems.packageId, packageId), isNull(rmaPackageItems.removedAt)));

  const shipmentNumber = await generateShipmentNumber(ownerUserId);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [shipment] = await tx
      .insert(rmaShipments)
      .values({
        ownerUserId,
        packageId,
        supplierAccountCode: pkg.supplierAccountCode,
        supplierName: pkg.supplierName,
        shipmentNumber,
        carrierName: input.carrierName?.trim(),
        trackingNumber: input.trackingNumber?.trim(),
        shippedByUserId: userId,
        notes: input.notes?.trim(),
        status: "sevk_edildi",
        shippedAt: now,
      })
      .returning();

    await tx
      .update(rmaPackages)
      .set({ status: "sevk_edildi", shippedAt: now })
      .where(eq(rmaPackages.id, packageId));

    for (const item of items) {
      const product = await getOwnedProduct(item.productId, ownerUserId);
      if (!product) continue;

      await tx
        .update(products)
        .set({ status: "tedarikcide" })
        .where(eq(products.id, item.productId));

      await tx.insert(statusHistory).values({
        productId: item.productId,
        status: "tedarikcide",
        previousStatus: product.status,
        changedByUserId: userId,
        notes: `Sevkiyat ${shipmentNumber}`,
      });

      await tx.insert(rmaProductMovements).values({
        ownerUserId,
        productId: item.productId,
        movementType: "tedarikciye_sevk",
        fromLocation: `koli:${pkg.packageNumber}`,
        toLocation: "tedarikci",
        packageId,
        shipmentId: shipment.id,
        performedByUserId: userId,
        notes: shipmentNumber,
      });
    }

    await tx.insert(rmaPackageHistory).values({
      packageId,
      ownerUserId,
      eventType: "sevk_edildi",
      performedByUserId: userId,
      notes: shipmentNumber,
    });

    return getPackageDetail(packageId, ownerUserId);
  });
}

export async function lookupPackage(
  query: string,
  ownerUserId: string,
) {
  await ensurePackageTables();
  const q = query.trim();
  if (!q) return undefined;

  const [pkg] = await db
    .select()
    .from(rmaPackages)
    .where(
      and(
        eq(rmaPackages.ownerUserId, ownerUserId),
        or(
          eq(rmaPackages.packageNumber, q),
          eq(rmaPackages.barcodeValue, q),
          eq(rmaPackages.qrValue, q),
          ilike(rmaPackages.packageNumber, q),
        )!,
      ),
    )
    .limit(1);

  if (pkg) return getPackageDetail(pkg.id, ownerUserId);

  const [byProduct] = await db
    .select({ pkgId: rmaPackages.id })
    .from(rmaPackages)
    .innerJoin(rmaPackageItems, eq(rmaPackageItems.packageId, rmaPackages.id))
    .innerJoin(products, eq(rmaPackageItems.productId, products.id))
    .innerJoin(tickets, eq(products.ticketId, tickets.id))
    .where(
      and(
        eq(rmaPackages.ownerUserId, ownerUserId),
        isNull(rmaPackageItems.removedAt),
        or(
          ilike(products.serialNumber, q),
          ilike(products.barcode, q),
          ilike(products.stockCode, q),
          ilike(tickets.receiptNumber, q),
          eq(products.serialNumber, q),
          eq(products.barcode, q),
        )!,
      ),
    )
    .limit(1);

  if (!byProduct) return undefined;
  return getPackageDetail(byProduct.pkgId, ownerUserId);
}

export async function getProductPackageInfo(productId: number, ownerUserId: string) {
  await ensurePackageTables();
  const [item] = await db
    .select({ item: rmaPackageItems, pkg: rmaPackages })
    .from(rmaPackageItems)
    .innerJoin(rmaPackages, eq(rmaPackageItems.packageId, rmaPackages.id))
    .where(
      and(
        eq(rmaPackageItems.productId, productId),
        isNull(rmaPackageItems.removedAt),
        eq(rmaPackages.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);

  if (!item) return null;

  const [shipment] = await db
    .select()
    .from(rmaShipments)
    .where(eq(rmaShipments.packageId, item.pkg.id))
    .orderBy(desc(rmaShipments.shippedAt))
    .limit(1);

  return { package: item.pkg, shipment };
}

export async function getProductMovements(productId: number, ownerUserId: string) {
  await ensurePackageTables();
  const product = await getOwnedProduct(productId, ownerUserId);
  if (!product) return [];

  return db
    .select()
    .from(rmaProductMovements)
    .where(
      and(eq(rmaProductMovements.productId, productId), eq(rmaProductMovements.ownerUserId, ownerUserId)),
    )
    .orderBy(desc(rmaProductMovements.createdAt));
}
