import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { APPROVED_B2B_ORDER_SQL } from "./b2b-approved-order-filter";

test("dashboard only lists confirmed, approved or paid B2B orders",async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      CREATE TABLE b2b_orders (
        id serial PRIMARY KEY,
        status text,
        payment_status text,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      INSERT INTO b2b_orders(status,payment_status) VALUES
        ('payment_pending','initializing'),
        ('awaiting_bank_confirmation','customer_reported_paid'),
        ('awaiting_bank_transfer',NULL),
        ('pending',NULL),
        ('cancel_requested','SUCCESS'),
        ('cancelled','SUCCESS'),
        ('payment_failed','FAILURE'),
        ('approved','SUCCESS'),
        ('confirmed','bank_confirmed'),
        ('paid','bank_confirmed'),
        ('onaylandi','SUCCESS'),
        (' paid ','SUCCESS'),
        ('PAID','3ds_failed_auth'),
        ('confirmed','initialize_failed'),
        ('approved','FAILURE'),
        ('paid_stock_review','bank_confirmed');
    `);
    const query=await db.query<{status:string,payment_status:string|null}>(`
      SELECT status,payment_status FROM b2b_orders
      WHERE ${APPROVED_B2B_ORDER_SQL}
      ORDER BY id
    `);
    assert.deepEqual(query.rows.map(row=>row.status),[
      'approved','confirmed','paid','onaylandi',' paid '
    ]);
    const count=await db.query<{count:number}>(`
      SELECT COUNT(*)::int count FROM b2b_orders
      WHERE ${APPROVED_B2B_ORDER_SQL}
    `);
    assert.equal(count.rows[0].count,5);
  }finally{await db.close();}
});

test("dashboard approved count and list use one shared predicate",()=>{
  assert.match(APPROVED_B2B_ORDER_SQL,/awaiting_bank_confirmation|approved/);
  assert.match(APPROVED_B2B_ORDER_SQL,/payment_status/);
});
