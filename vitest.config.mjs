import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// Integration tests use TEST_DATABASE_URL from the environment or .env.local. It's read here
// rather than loading .env.local wholesale, so unit tests never depend on local env values.
const localEnv = existsSync(".env.local")
  ? parseEnv(readFileSync(".env.local", "utf8"))
  : {};
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? localEnv.TEST_DATABASE_URL;
if (testDatabaseUrl) process.env.TEST_DATABASE_URL = testDatabaseUrl; // for globalSetup

// Two projects (docs/ARCHITECTURE.md §7). Inline projects inherit this root config.
// - unit: pure code next to its source (src/**/*.test.js), runs in parallel.
// - integration: real Postgres (the *_test database), one file at a time.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside React Server Components; tests import server modules directly.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.{js,jsx}"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.js"],
          fileParallelism: false,
          globalSetup: ["tests/integration/global-setup.js"],
          // Server code reads DATABASE_URL; in integration tests that is the test database.
          env: { DATABASE_URL: testDatabaseUrl ?? "" },
        },
      },
    ],
  },
});
