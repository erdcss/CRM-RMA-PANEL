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
  account_code TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  receipt_number TEXT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_by_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
  owner_user_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Bilinmeyen',
  serial_number TEXT,
  stock_code TEXT,
  brand TEXT DEFAULT 'Bilinmeyen',
  model TEXT,
  category TEXT DEFAULT 'servis',
  status TEXT NOT NULL DEFAULT 'beklemede',
  description TEXT,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS status_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS catalog_products (
  id SERIAL PRIMARY KEY,
  stock_code TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (stock_code, owner_user_id)
);
CREATE TABLE IF NOT EXISTS catalog_customers (
  id SERIAL PRIMARY KEY,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (account_code, owner_user_id)
);
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
  await client.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS owner_user_id TEXT;');
  await client.exec(`
    CREATE TABLE IF NOT EXISTS catalog_products (
      id SERIAL PRIMARY KEY,
      stock_code TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (stock_code, owner_user_id)
    );
  `);
  await client.exec(`
    CREATE TABLE IF NOT EXISTS catalog_customers (
      id SERIAL PRIMARY KEY,
      account_code TEXT NOT NULL,
      account_name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (account_code, owner_user_id)
    );
  `);
  await client.exec('ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_code TEXT;');
  await client.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT \'servis\';');
  await client.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS catalog_customer_id INTEGER;');
  await client.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sales_id TEXT;');
  await client.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS invoice_id TEXT;');
  await client.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS invoice_number TEXT;');
  await client.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sale_date TIMESTAMP;');
  await client.exec('ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_product_id INTEGER;');
  await client.exec('ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;');
  await client.exec('ALTER TABLE products ADD COLUMN IF NOT EXISTS defect_reason TEXT;');
  await client.exec('ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_location TEXT DEFAULT \'rma_deposu\';');
  await client.exec('ALTER TABLE status_history ADD COLUMN IF NOT EXISTS previous_status TEXT;');
  await client.exec('ALTER TABLE status_history ADD COLUMN IF NOT EXISTS changed_by_user_id TEXT;');
  await client.exec(`
    CREATE TABLE IF NOT EXISTS supplier_items (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      supplier_account_code TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      supplier_status TEXT DEFAULT 'bekliyor',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT supplier_items_product_owner_unique UNIQUE (product_id, owner_user_id)
    );
  `);
  const db = drizzle({ client, schema });
  console.log(`Using local PGlite database at ${dataDir}`);
  return { db, pool: undefined };
}

const { db, pool } = await createDatabase();

export { db, pool };
