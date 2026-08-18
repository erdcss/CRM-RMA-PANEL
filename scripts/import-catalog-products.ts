import "dotenv/config";
import pg from "pg";
import { createRequire } from "module";

import { storage } from "../server/storage";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const OWNER_EMAIL = "erdemcls94@gmail.com";
const EXCEL_PATH = "c:/Users/Win/Downloads/ürünler (1).xlsx";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalog_products (
      id SERIAL PRIMARY KEY,
      stock_code TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (stock_code, owner_user_id)
    );
  `);

  const userResult = await pool.query(
    "SELECT id FROM auth.users WHERE lower(email) = lower($1)",
    [OWNER_EMAIL],
  );

  const ownerUserId = userResult.rows[0]?.id as string | undefined;
  if (!ownerUserId) {
    await pool.end();
    throw new Error(`Kullanıcı bulunamadı: ${OWNER_EMAIL}`);
  }

  await pool.end();

  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

  const items = rows
    .map((row) => ({
      stockCode: String(row["Stok Kodu"] ?? "").trim(),
      stockName: String(row["Stok Adı"] ?? "").trim(),
      ownerUserId,
    }))
    .filter((item) => item.stockCode && item.stockName);

  await storage.ensureSystemUser();
  const count = await storage.bulkUpsertCatalogProducts(items);

  console.log(`Imported ${count} catalog products for ${OWNER_EMAIL} (${ownerUserId})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
