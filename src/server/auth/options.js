import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError } from "better-auth/api";
import { isEmailAllowed } from "./allowlist.js";

// Better Auth options, built in one place for both the running app (auth.js) and the Better Auth
// CLI that generates the auth tables. Deliberately free of `server-only` and env reads: the CLI
// can't load either (docs/ARCHITECTURE.md §4.1).

export const EMAIL_NOT_ALLOWED = "EMAIL_NOT_ALLOWED";

function notAllowed() {
  return new APIError("FORBIDDEN", {
    message: "This Google account isn't allowed to sign in to Yoddha Prep.",
    code: EMAIL_NOT_ALLOWED, // makes the OAuth callback redirect with ?error=EMAIL_NOT_ALLOWED
  });
}

/**
 * @param {{
 *   db: Parameters<typeof drizzleAdapter>[0],
 *   schema?: Record<string, unknown>,
 *   secret: string,
 *   baseURL: string,
 *   google: { clientId: string, clientSecret: string },
 *   allowlist: ReadonlySet<string>,
 * }} config
 */
export function buildAuthOptions({
  db,
  schema,
  secret,
  baseURL,
  google,
  allowlist,
}) {
  return {
    appName: "Yoddha Prep",
    secret,
    baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    // Google is the only way in; email/password stays disabled (Better Auth's default).
    // No plugins: most past Better Auth advisories were in plugins.
    socialProviders: {
      google: {
        clientId: google.clientId,
        clientSecret: google.clientSecret,
        requireEmailVerification: true,
      },
    },
    advanced: {
      database: { generateId: /** @type {const} */ ("uuid") },
    },
    // Sessions live in the database (default) and the cookie cache stays off, so revoking a
    // session takes effect on the next request.
    databaseHooks: {
      user: {
        create: {
          // New accounts: allowlisted, Google-verified emails only.
          before: async (
            /** @type {{ email?: string, emailVerified?: boolean }} */ user,
          ) => {
            if (
              user.emailVerified !== true ||
              !isEmailAllowed(allowlist, user.email)
            ) {
              throw notAllowed();
            }
          },
        },
      },
      session: {
        create: {
          // Every sign-in: re-check, so removing an email from ALLOWED_EMAILS locks that user out.
          // Fails closed when there's no request context to look the user up with.
          before: async (
            /** @type {{ userId: string }} */ session,
            /** @type {{ context: { internalAdapter: { findUserById(id: string): Promise<{ email?: string } | null> } } } | null} */ ctx,
          ) => {
            const user = ctx
              ? await ctx.context.internalAdapter.findUserById(session.userId)
              : null;
            if (!user || !isEmailAllowed(allowlist, user.email)) {
              throw notAllowed();
            }
          },
        },
      },
    },
  };
}
