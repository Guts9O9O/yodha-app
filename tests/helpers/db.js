import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client.js";

// Integration-test helpers. DATABASE_URL points at the *_test database (vitest.config.mjs).

/** Empty every table (keeps the migrations journal). Call in beforeEach. */
export async function resetDatabase() {
  const db = getDb();
  // Defence in depth: global setup already refuses non-test databases.
  const { rows: current } = await db.execute(
    sql`select current_database() as name`,
  );
  if (!String(current[0].name).endsWith("_test")) {
    throw new Error(
      `resetDatabase refused: connected to "${current[0].name}", not a *_test database`,
    );
  }
  const { rows } = await db.execute(
    sql`select tablename from pg_tables where schemaname = 'public' and tablename not like '__drizzle%'`,
  );
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"${r.tablename}"`).join(", ");
  await db.execute(
    sql.raw(`truncate table ${tables} restart identity cascade`),
  );
}
