import { and, desc, eq, isNull, or } from "drizzle-orm";

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
  const patch: Record<string, unknown> = { updatedAt: new Date() };
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

export async function deleteSupplierItem(id: number, ownerUserId: string) {
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

  const patch: Record<string, unknown> = {};
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

  await db
    .update(supplierItems)
    .set({ updatedAt: new Date() })
    .where(and(eq(supplierItems.productId, productId), eq(supplierItems.ownerUserId, ownerUserId)));

  return updated;
}
