import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";

// Layer boundaries from docs/ARCHITECTURE.md §3. Regexes match both "@/server/db/x"
// and relative paths like "../../server/db".
const NO_DB_OUTSIDE_SERVER = {
  regex: "(^|/)server/db(/|$)",
  message:
    "Only src/server/dal (and other src/server code) may touch the database. Call a DAL function instead.",
};
const NO_PG_OUTSIDE_DB = {
  regex: "^pg(/|$)",
  message:
    "Use the Drizzle client from src/server/db; raw pg queries return DATE values as JS Dates.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  prettier,

  // Dates: date-only values stay 'YYYY-MM-DD' strings; all conversion lives in src/lib/dates.js.
  {
    files: ["src/**/*.{js,jsx,mjs}"],
    ignores: ["src/lib/dates.js", "src/lib/dates.test.js"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length>0]",
          message:
            "Don't construct Dates from values here; use src/lib/dates.js (date-only values must never shift through UTC).",
        },
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='parse']",
          message: "Don't use Date.parse; use src/lib/dates.js.",
        },
      ],
    },
  },

  // Routes, feature UI and shared components never reach the database directly.
  {
    files: ["src/app/**", "src/features/**", "src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [NO_DB_OUTSIDE_SERVER, NO_PG_OUTSIDE_DB] },
      ],
    },
  },

  // src/lib is pure and isomorphic: no server code, no Next.js, no I/O.
  {
    files: ["src/lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "(^|/)server(/|$)|^server-only$",
              message:
                "src/lib must stay pure; move server code to src/server.",
            },
            {
              regex: "^next(/|$)",
              message: "src/lib must not depend on Next.js.",
            },
            NO_PG_OUTSIDE_DB,
          ],
        },
      ],
    },
  },

  // Inside src/server, only src/server/db may import pg.
  {
    files: ["src/server/**"],
    ignores: ["src/server/db/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [NO_PG_OUTSIDE_DB] }],
    },
  },

  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated or tool output:
    "drizzle/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
