import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const email = "erdemcls94@gmail.com";

const result = await pool.query(
  "SELECT id, email FROM auth.users WHERE lower(email) = lower($1)",
  [email],
);
console.log(result.rows);
await pool.end();
