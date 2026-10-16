import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "./db";

/**
 * A payment reference may be displayed BEFORE an order exists.
 * The reference is owned by one authenticated B2B user and may be consumed
 * by at most one order. Reservation is NOT proof of payment.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS b2b_bank_transfer_references (
  reservation_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  transfer_code TEXT NOT NULL UNIQUE,
  order_number TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS b2b_bank_transfer_references_user
  ON b2b_bank_transfer_references(user_id, created_at DESC);
`;
let schema: Promise<unknown> | undefined;
async function ready() {
  if (!pool) throw new Error("Banka referans veritabanı kullanılamıyor");
  if (!schema) schema = pool.query(DDL).catch((err) => { schema = undefined; throw err; });
  await schema;
  return pool;
}

export class BankReferenceError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export async function reserveB2BBankReference(userId: number) {
  const db = await ready();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const transferCode = `CLK${String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0")}`;
    const existing = await db.query("SELECT 1 FROM b2b_orders WHERE transfer_code = $1 LIMIT 1", [transferCode]);
    if (existing.rows.length) continue;
    const reservationId = randomBytes(18).toString("hex");
    const r = await db.query(`
      INSERT INTO b2b_bank_transfer_references(reservation_id,user_id,transfer_code)
      VALUES($1,$2,$3) ON CONFLICT DO NOTHING
      RETURNING reservation_id,transfer_code,expires_at
    `, [reservationId, userId, transferCode]);
    if (r.rows[0]) {
      return {
        reservationId: String(r.rows[0].reservation_id),
        transferCode: String(r.rows[0].transfer_code),
        transferDescription: String(r.rows[0].transfer_code),
        expiresAt: r.rows[0].expires_at,
      };
    }
  }
  throw new Error("Havale kodu oluşturulamadı. Biraz sonra tekrar deneyin.");
}

/** Called WITHIN the order-creation transaction. Locks reference to prevent double checkout. */
export async function lockB2BBankReference(
  client: PoolClient, userId: number, reservationId: unknown,
): Promise<{code: string; existingOrderNumber: string | null}> {
  if (typeof reservationId !== "string" || !/^[0-9a-f]{36}$/.test(reservationId)) {
    throw new BankReferenceError(400, "Geçerli havale açıklama kodu gerekiyor");
  }
  const found = await client.query(`
    SELECT transfer_code,order_number,expires_at
    FROM b2b_bank_transfer_references
    WHERE reservation_id=$1 AND user_id=$2
    FOR UPDATE
  `, [reservationId, userId]);
  const item = found.rows[0];
  if (!item) throw new BankReferenceError(404, "Havale kodu bulunamadı. Yeni kod alın.");
  if (!item.order_number && new Date(item.expires_at).getTime() < Date.now()) {
    throw new BankReferenceError(409, "Havale kodunun süresi doldu. Yeni kod alın.");
  }
  return {code: String(item.transfer_code), existingOrderNumber: item.order_number ? String(item.order_number) : null};
}
export async function bindB2BBankReference(
  client: PoolClient, userId: number, reservationId: string, orderNumber: string,
) {
  const r = await client.query(`
    UPDATE b2b_bank_transfer_references
    SET order_number=$1 WHERE reservation_id=$2 AND user_id=$3 AND order_number IS NULL
    RETURNING reservation_id
  `, [orderNumber,reservationId,userId]);
  if (!r.rows[0]) throw new BankReferenceError(409, "Havale kodu daha önce kullanılmış");
}
export async function findB2BBankReferenceOrder(userId: number, reservationId: unknown) {
  if (typeof reservationId !== "string" || !/^[0-9a-f]{36}$/.test(reservationId)) return null;
  const db = await ready();
  const r = await db.query(`
    SELECT o.order_number,o.total_amount,r.transfer_code
    FROM b2b_bank_transfer_references r
    JOIN b2b_orders o ON o.order_number=r.order_number AND o.user_id=r.user_id
    WHERE r.reservation_id=$1 AND r.user_id=$2 AND o.payment_method='bank_transfer'
    LIMIT 1
  `, [reservationId,userId]);
  return r.rows[0] || null;
}
export async function ensureB2BBankReferenceTable() { await ready(); }
