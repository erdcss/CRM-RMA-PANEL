import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const owner = "61432a26-185f-4f7f-9562-f9d0d86b9625";
const count = await pool.query(
  "SELECT count(*)::int AS c FROM catalog_products WHERE owner_user_id = $1",
  [owner],
);
console.log("count", count.rows[0].c);
const sample = await pool.query(
  "SELECT stock_code, stock_name FROM catalog_products WHERE owner_user_id = $1 LIMIT 3",
  [owner],
);
console.log(sample.rows);
await pool.end();
