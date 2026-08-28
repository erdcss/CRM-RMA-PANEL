import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { users } from "../shared/schema";

const username = process.env.PANEL_USER?.trim();
const password = process.env.PANEL_PASS;

if (!username || !password) {
  console.error("PANEL_USER and PANEL_PASS are required");
  process.exit(1);
}

const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);

if (existing[0]) {
  await db.update(users).set({ password }).where(eq(users.username, username));
} else {
  await db.insert(users).values({ username, password });
}

const admin = await db.select().from(users).where(eq(users.username, "admin")).limit(1);
if (admin[0]) {
  await db.update(users).set({ password }).where(eq(users.username, "admin"));
}

console.log(`Local panel user ready: ${username}`);
process.exit(0);
