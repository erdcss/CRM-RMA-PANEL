import { and, desc, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "./db";
import { products, supplierItems, tickets } from "@shared/schema";

export type SupplierAssignmentInput = {
  productId: number;
  supplierAccountCode: string;
  supplierName: string;
  notes?: string;
};

export type SupplierAssignmentUpdate = {
  supplierAccountCode?: string;
  supplierName?: string;
  notes?: string | null;
};

export type ProductEditInput = {
  name?: string;
  stockCode?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  category?: "iade" | "degisim" | "servis";
  description?: string | null;
  quantity?: number;
};

let supplierSchemaPromise: Promise<void> | null = null;

export function ensureSupplierItemsTable() {
  if (!supplierSchemaPromise) {
    supplierSchemaPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS supplier_items (
          id SERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          supplier_account_code TEXT NOT NULL,
          supplier_name TEXT NOT NULL,
          owner_user_id TEXT NOT NULL,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT supplier_items_product_owner_unique UNIQUE (product_id, owner_user_id)
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS supplier_items_owner_idx ON supplier_items(owner_user_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS supplier_items_supplier_idx ON supplier_items(owner_user_id, supplier_account_code)`);
    })().catch((error) => {
      supplierSchemaPromise = null;
      throw error;
    });
  }
  return supplierSchemaPromise;
}

export async function getOwnedProduct(productId: number, ownerUserId: string) {
  const [row] = await db
    .select({ product: products })
    .from(products)
    .innerJoin(tickets, eq(products.ticketId, tickets.id))
    .where(
      and(
        eq(products.id, productId),
        or(eq(tickets.ownerUserId, ownerUserId), isNull(tickets.ownerUserId)),
      ),
    )
    .limit(1);

  return row?.product;
}

export async function listSupplierItems(ownerUserId: string) {
  await ensureSupplierItemsTable();
  return db.query.supplierItems.findMany({
    where: eq(supplierItems.ownerUserId, ownerUserId),
    with: {
      product: {
        with: {
          ticket: {
            with: {
              customer: true,
            },
          },
          statusHistory: {
            orderBy: (history, { desc }) => [desc(history.createdAt)],
          },
        },
      },
    },
    orderBy: [desc(supplierItems.updatedAt), desc(supplierItems.createdAt)],
  });
}

export async function createOrMoveSupplierItem(ownerUserId: string, input: SupplierAssignmentInput) {
  await ensureSupplierItemsTable();
  const product = await getOwnedProduct(input.productId, ownerUserId);
  if (!product) return undefined;

  const [assignment] = await db
    .insert(supplierItems)
    .values({
      productId: input.productId,
      supplierAccountCode: input.supplierAccountCode.trim(),
      supplierName: input.supplierName.trim(),
      ownerUserId,
      notes: input.notes?.trim() || undefined,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [supplierItems.productId, supplierItems.ownerUserId],
      set: {
        supplierAccountCode: input.supplierAccountCode.trim(),
        supplierName: input.supplierName.trim(),
        notes: input.notes?.trim() || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return assignment;
}

export async function updateSupplierItem(
  id: number,
  ownerUserId: string,
  input: SupplierAssignmentUpdate,
) {
  await ensureSupplierItemsTable();
  const patch: Partial<typeof supplierItems.$inferInsert> = { updatedAt: new Date() };
  if (input.supplierAccountCode !== undefined) patch.supplierAccountCode = input.supplierAccountCode.trim();
  if (input.supplierName !== undefined) patch.supplierName = input.supplierName.trim();
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

  const [assignment] = await db
    .update(supplierItems)
    .set(patch)
    .where(and(eq(supplierItems.id, id), eq(supplierItems.ownerUserId, ownerUserId)))
    .returning();

  return assignment;
}

export async function touchSupplierItemForProduct(productId: number, ownerUserId: string) {
  await ensureSupplierItemsTable();
  await db
    .update(supplierItems)
    .set({ updatedAt: new Date() })
    .where(and(eq(supplierItems.productId, productId), eq(supplierItems.ownerUserId, ownerUserId)));
}

export async function deleteSupplierItem(id: number, ownerUserId: string) {
  await ensureSupplierItemsTable();
  const deleted = await db
    .delete(supplierItems)
    .where(and(eq(supplierItems.id, id), eq(supplierItems.ownerUserId, ownerUserId)))
    .returning({ id: supplierItems.id });

  return deleted.length > 0;
}

export async function updateOwnedProduct(
  productId: number,
  ownerUserId: string,
  input: ProductEditInput,
) {
  const owned = await getOwnedProduct(productId, ownerUserId);
  if (!owned) return undefined;

  const patch: Partial<typeof products.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.stockCode !== undefined) patch.stockCode = input.stockCode?.trim() || null;
  if (input.brand !== undefined) patch.brand = input.brand?.trim() || null;
  if (input.model !== undefined) patch.model = input.model?.trim() || null;
  if (input.serialNumber !== undefined) patch.serialNumber = input.serialNumber?.trim() || null;
  if (input.category !== undefined) patch.category = input.category;
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.quantity !== undefined) patch.quantity = input.quantity;

  if (Object.keys(patch).length === 0) return owned;

  const [updated] = await db
    .update(products)
    .set(patch)
    .where(eq(products.id, productId))
    .returning();

  await touchSupplierItemForProduct(productId, ownerUserId);
  return updated;
}
