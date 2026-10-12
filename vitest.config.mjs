import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Two projects (docs/ARCHITECTURE.md §7). Inline projects inherit this root config.
// - unit: pure code next to its source (src/**/*.test.js), runs in parallel.
// - integration: real Postgres via TEST_DATABASE_URL, one file at a time (tests arrive in M2).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
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
        },
      },
    ],
  },
});
