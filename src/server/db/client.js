import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { dbEnv } from "../env.js";

// Raw pg turns DATE (oid 1082) into a local-time JS Date, which can shift the day.
// Drizzle already keeps DATE as 'YYYY-MM-DD' for its own queries; this covers anything
// else that queries through pg (docs/ARCHITECTURE.md §6).
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

/**
 * One pool per process. Kept on globalThis so Next.js dev reloads don't open new pools.
 * @type {{ pool?: pg.Pool, db?: import("drizzle-orm/node-postgres").NodePgDatabase }}
 */
const cache = (globalThis.__yoddhaDb ??= {});

/**
 * The Drizzle client (core query builder only; no relational `db.query`).
 * Created on first use so builds and tools that never query don't need DATABASE_URL.
 */
export function getDb() {
  if (!cache.db) {
    // Small pool: Neon's pooler (PgBouncer) does the real pooling in production.
    const pool = new pg.Pool({
      connectionString: dbEnv().DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
    // On Vercel Fluid compute, releases idle clients before the instance suspends.
    // A no-op elsewhere.
    attachDatabasePool(pool);
    cache.pool = pool;
    cache.db = drizzle({ client: pool, casing: "snake_case" });
  }
  return cache.db;
}

/** Close the pool (tests and scripts). The next getDb() opens a new one. */
export async function closeDb() {
  const pool = cache.pool;
  cache.pool = undefined;
  cache.db = undefined;
  await pool?.end();
}
