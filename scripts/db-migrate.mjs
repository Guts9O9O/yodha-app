// Apply the committed SQL migrations in ./drizzle (docs/ARCHITECTURE.md §8.2).
//   npm run db:migrate   → local dev database (DATABASE_URL_DIRECT, else DATABASE_URL, from .env.local)
// Integration tests call migrateDatabase() for the *_test database. Production migrations go
// through `npm run db:migrate:prod`, which takes a backup first (docs/BACKUP.md).
import { fileURLToPath, pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

/** Host and database name only, never credentials. */
export function describeDatabase(url) {
  const { hostname, port, pathname } = new URL(url);
  return `${hostname}${port ? `:${port}` : ""}${pathname}`;
}

/** @param {string} url */
export async function migrateDatabase(url) {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: MIGRATIONS_FOLDER,
    });
  } catch (error) {
    // Drizzle wraps driver errors as "Failed query: …"; surface the real reason. Connection
    // failures can be an AggregateError with an empty message, so fall back to its code.
    const cause = error?.cause ?? error;
    const reason =
      cause?.message ||
      cause?.errors?.find((e) => e?.message)?.message ||
      cause?.code ||
      String(cause);
    throw new Error(`Migrating ${describeDatabase(url)} failed: ${reason}`, {
      cause: error,
    });
  } finally {
    await pool.end();
  }
}

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Set DATABASE_URL_DIRECT or DATABASE_URL (see .env.example).",
    );
    process.exit(1);
  }
  console.log(`Migrating ${describeDatabase(url)} …`);
  await migrateDatabase(url);
  console.log("Migrations applied.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
