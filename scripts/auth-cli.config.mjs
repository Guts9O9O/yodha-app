// Used only by the Better Auth CLI to (re)generate src/server/db/schema/auth.js:
//   npm run auth:generate
// It builds the same options as the app (src/server/auth/options.js) with placeholder values.
// The CLI reads the table shapes from it; nothing connects to a database or uses these secrets.
import { betterAuth } from "better-auth";
import { drizzle } from "drizzle-orm/node-postgres";
import { buildAuthOptions } from "../src/server/auth/options.js";

export const auth = betterAuth(
  buildAuthOptions({
    db: drizzle({
      connection: "postgresql://cli:cli@localhost:1/never-connected",
    }),
    secret: "placeholder-secret-for-the-better-auth-cli-only",
    baseURL: "http://localhost:3000",
    google: { clientId: "placeholder", clientSecret: "placeholder" },
    allowlist: new Set(["placeholder@example.com"]),
  }),
);
