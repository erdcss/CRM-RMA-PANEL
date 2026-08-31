import "dotenv/config";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const files = [
  "20260818_001_owner_user_id.sql",
  "20260818_002_catalog_products.sql",
  "20260818_003_product_stock_code.sql",
  "20260818_004_catalog_customers.sql",
  "20260818_005_customer_account_code.sql",
  "20260831_001_rma_faz1.sql",
  "20260831_002_rma_faz2_packages.sql",
  "20260831_003_rma_faz3_supplier_results.sql",
];

for (const file of files) {
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", file), "utf8");
  console.log("Running", file);
  await pool.query(sql);
}

console.log("Migrations applied");
await pool.end();
