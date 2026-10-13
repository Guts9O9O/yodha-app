import { defineConfig } from "drizzle-kit";

// drizzle-kit *generates* SQL migrations from the schema (no database needed) and runs Studio.
// Migrations are *applied* by scripts/db-migrate.mjs, never by the Vercel build
// (docs/ARCHITECTURE.md §8.2).
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: use the environment as-is.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.js",
  out: "./drizzle",
  casing: "snake_case",
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "",
  },
});
