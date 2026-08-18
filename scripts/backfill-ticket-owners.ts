import "dotenv/config";
import pg from "pg";

const OWNER_EMAIL = "erdemcls94@gmail.com";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  const userResult = await pool.query(
    "SELECT id FROM auth.users WHERE lower(email) = lower($1)",
    [OWNER_EMAIL],
  );
  const ownerUserId = userResult.rows[0]?.id as string | undefined;
  if (!ownerUserId) {
    throw new Error(`Kullanıcı bulunamadı: ${OWNER_EMAIL}`);
  }

  const result = await pool.query(
    "UPDATE tickets SET owner_user_id = $1 WHERE owner_user_id IS NULL RETURNING id",
    [ownerUserId],
  );

  console.log(`Backfilled owner_user_id on ${result.rowCount} ticket(s) for ${OWNER_EMAIL}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
