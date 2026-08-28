import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "@shared/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOCAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT DEFAULT 'Bilinmeyen',
  phone TEXT DEFAULT '-',
  email TEXT,
  address TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  receipt_number TEXT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_by_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Bilinmeyen',
  serial_number TEXT,
  brand TEXT DEFAULT 'Bilinmeyen',
  model TEXT,
  category TEXT DEFAULT 'servis',
  status TEXT NOT NULL DEFAULT 'beklemede',
  description TEXT,
  quantity INTEGER DEFAULT 1,
  image_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS status_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

const PHASE1_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  invoice_date TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS fault_reason TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_id INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS invoice_id INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'rma_depo';
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  from_warehouse_id INTEGER,
  to_warehouse_id INTEGER,
  movement_type TEXT NOT NULL,
  notes TEXT,
  created_by_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
INSERT INTO warehouses (name, code)
SELECT 'RMA Deposu', 'rma'
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE code = 'rma');
INSERT INTO warehouses (name, code)
SELECT 'Satılabilir Stok', 'satilabilir'
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE code = 'satilabilir');
INSERT INTO warehouses (name, code)
SELECT 'Hurda', 'hurda'
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE code = 'hurda');
`;

async function createDatabase() {
  if (process.env.DATABASE_URL) {
    const pg = (await import("pg")).default;
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool, schema });
    return { db, pool };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dataDir = path.resolve(__dirname, "..", "data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const client = await PGlite.create(dataDir);
  await client.exec(LOCAL_SCHEMA_SQL);
  await client.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;`);
  await client.exec(PHASE1_SCHEMA_SQL);
  const db = drizzle({ client, schema });
  console.log(`Using local PGlite database at ${dataDir}`);
  return { db, pool: undefined };
}

const { db, pool } = await createDatabase();

if (pool) {
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await pool.query(PHASE1_SCHEMA_SQL);
}

export { db, pool };
