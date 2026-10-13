import "server-only";
import { betterAuth } from "better-auth";
import { getDb } from "../db/client.js";
import * as authSchema from "../db/schema/auth.js";
import { authEnv } from "../env.js";
import { parseAllowlist } from "./allowlist.js";
import { buildAuthOptions } from "./options.js";

/** @type {{ auth?: ReturnType<typeof betterAuth>, allowlist?: ReadonlySet<string> }} */
const cache = {};

/**
 * The parsed ALLOWED_EMAILS list. Env vars are read once per server instance, so a change in
 * Vercel takes effect on the next deployment.
 */
export function getAllowlist() {
  return (cache.allowlist ??= parseAllowlist(authEnv().ALLOWED_EMAILS));
}

/** The Better Auth instance, created on first use so builds don't need auth secrets. */
export function getAuth() {
  if (!cache.auth) {
    const env = authEnv();
    cache.auth = betterAuth(
      buildAuthOptions({
        db: getDb(),
        schema: authSchema,
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
        allowlist: getAllowlist(),
      }),
    );
  }
  return cache.auth;
}
