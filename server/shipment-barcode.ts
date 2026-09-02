import { randomInt } from "crypto";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import {
  isValidShipmentBarcodeNumber,
  needsShipmentBarcodeAllocation,
  SHIPMENT_BARCODE_LENGTH,
} from "@shared/shipment-barcode";
import { products, tickets } from "@shared/schema";

import { db } from "./db";
import { getOwnedProduct } from "./suppliers";

const MAX_ALLOCATION_ATTEMPTS = 40;

let schemaPromise: Promise<void> | null = null;

export function ensureShipmentBarcodeSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode_number TEXT`);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_number_unique
        ON products (barcode_number)
        WHERE barcode_number IS NOT NULL
      `);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function generateShipmentBarcodeCandidate(): string {
  return randomInt(0, 1_000_000_000).toString().padStart(SHIPMENT_BARCODE_LENGTH, "0");
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === "23505";
}

/**
 * Idempotent: returns existing barcode_number or allocates a new globally unique 9-digit value.
 */
export async function ensureProductShipmentBarcode(
  productId: number,
  ownerUserId: string,
): Promise<{ barcodeNumber: string }> {
  await ensureShipmentBarcodeSchema();

  const owned = await getOwnedProduct(productId, ownerUserId);
  if (!owned) {
    throw new Error("Product not found");
  }

  if (isValidShipmentBarcodeNumber(owned.barcodeNumber)) {
    return { barcodeNumber: owned.barcodeNumber };
  }

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: products.id, barcodeNumber: products.barcodeNumber })
      .from(products)
      .where(eq(products.id, productId))
      .for("update");

    if (!locked) {
      throw new Error("Product not found");
    }

    if (isValidShipmentBarcodeNumber(locked.barcodeNumber)) {
      return { barcodeNumber: locked.barcodeNumber };
    }

    for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt++) {
      const candidate = generateShipmentBarcodeCandidate();

      const [collision] = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.barcodeNumber, candidate))
        .limit(1);

      if (collision) continue;

      try {
        const [updated] = await tx
          .update(products)
          .set({ barcodeNumber: candidate, barcode: candidate })
          .where(eq(products.id, productId))
          .returning();

        if (updated?.barcodeNumber && isValidShipmentBarcodeNumber(updated.barcodeNumber)) {
          return { barcodeNumber: updated.barcodeNumber };
        }

        const [refetched] = await tx
          .select({ barcodeNumber: products.barcodeNumber })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);

        if (isValidShipmentBarcodeNumber(refetched?.barcodeNumber)) {
          return { barcodeNumber: refetched.barcodeNumber };
        }
      } catch (error) {
        if (isUniqueViolation(error)) continue;
        throw error;
      }
    }

    throw new Error("Barkod numarası oluşturulamadı.");
  });
}

export async function ensureProductShipmentBarcodes(
  productIds: number[],
  ownerUserId: string,
): Promise<Record<number, string>> {
  await ensureShipmentBarcodeSchema();

  const uniqueIds = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueIds.length) return {};

  const ownedRows = await db
    .select({ id: products.id, barcodeNumber: products.barcodeNumber })
    .from(products)
    .innerJoin(tickets, eq(products.ticketId, tickets.id))
    .where(
      and(
        inArray(products.id, uniqueIds),
        or(eq(tickets.ownerUserId, ownerUserId), isNull(tickets.ownerUserId)),
      ),
    );

  const result: Record<number, string> = {};
  const missing: number[] = [];

  for (const row of ownedRows) {
    if (isValidShipmentBarcodeNumber(row.barcodeNumber)) {
      result[row.id] = row.barcodeNumber;
    } else if (needsShipmentBarcodeAllocation(row.barcodeNumber)) {
      missing.push(row.id);
    }
  }

  for (const productId of missing) {
    const { barcodeNumber } = await ensureProductShipmentBarcode(productId, ownerUserId);
    result[productId] = barcodeNumber;
  }

  return result;
}
