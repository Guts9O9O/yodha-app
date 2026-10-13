// Migrate PRODUCTION safely (docs/ARCHITECTURE.md §8.2, docs/BACKUP.md):
//   npm run db:migrate:prod -- --yes
// 1. Prints the target and refuses to continue without --yes.
// 2. Takes a backup; stops if it fails.
// 3. Applies the committed migrations over the direct connection (DATABASE_URL_DIRECT,
//    from .env.prod.local).
import { assertDirectUrl, backupDatabase } from "./db-backup.mjs";
import { describeDatabase, migrateDatabase } from "./db-migrate.mjs";

const url = process.env.DATABASE_URL_DIRECT;

try {
  assertDirectUrl(url);
  console.log(`Target: ${describeDatabase(url)}`);
  if (!process.argv.includes("--yes")) {
    console.log(
      "Re-run with --yes to back up and migrate this database: npm run db:migrate:prod -- --yes",
    );
    process.exit(1);
  }
  backupDatabase(url, "yoddha-prod-premigrate");
  await migrateDatabase(url);
  console.log("Migrations applied.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
