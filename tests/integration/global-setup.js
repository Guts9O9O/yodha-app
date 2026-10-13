import {
  describeDatabase,
  migrateDatabase,
} from "../../scripts/db-migrate.mjs";

// Runs once before the integration project. Integration tests wipe their database, so refuse
// to run unless it is clearly a test database; then bring it up to the latest migration.
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Add it to .env.local (see .env.example) and run `npm run db:up`.",
    );
  }
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against "${name}": the database name must end in _test.`,
    );
  }
  try {
    await migrateDatabase(url);
  } catch (error) {
    throw new Error(
      `Couldn't migrate ${describeDatabase(url)}. Is Postgres running (npm run db:up)?`,
      { cause: error },
    );
  }
}
