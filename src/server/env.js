import "server-only";
import * as z from "zod";

// Server environment, validated on first use (docs/ARCHITECTURE.md §8.2, .env.example).
// Grouped so code that only needs the database doesn't also require auth secrets.
// Error messages name the variable and the problem, never the value.

const postgresUrl = z.url({
  protocol: /^postgres(ql)?$/,
  error: "must be a postgres:// or postgresql:// connection string",
});

const dbSchema = z.object({
  DATABASE_URL: postgresUrl,
});

const authSchema = z.object({
  BETTER_AUTH_SECRET: z
    .string({ error: "is required" })
    .min(32, { error: "must be at least 32 characters" }),
  BETTER_AUTH_URL: z.url({
    protocol: /^https?$/,
    error: "must be an http(s) URL",
  }),
  GOOGLE_CLIENT_ID: z
    .string({ error: "is required" })
    .min(1, { error: "is required" }),
  GOOGLE_CLIENT_SECRET: z
    .string({ error: "is required" })
    .min(1, { error: "is required" }),
  ALLOWED_EMAILS: z
    .string({ error: "is required" })
    .min(1, { error: "is required" }),
});

/**
 * @template {z.ZodType} T
 * @param {string} group
 * @param {T} schema
 * @param {Record<string, string | undefined>} source
 * @returns {Readonly<z.infer<T>>}
 */
function parseGroup(group, schema, source) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")} ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid ${group} environment: ${problems}. See .env.example.`,
    );
  }
  return Object.freeze(result.data);
}

/** @type {{ db?: Readonly<z.infer<typeof dbSchema>>, auth?: Readonly<z.infer<typeof authSchema>> }} */
const cache = {};

/**
 * Database settings. Pass `source` only in tests; the default reads (and caches) process.env.
 * @param {Record<string, string | undefined>} [source]
 */
export function dbEnv(source) {
  if (source) return parseGroup("database", dbSchema, source);
  return (cache.db ??= parseGroup("database", dbSchema, process.env));
}

/**
 * Auth settings (Better Auth + Google + allowlist).
 * @param {Record<string, string | undefined>} [source]
 */
export function authEnv(source) {
  if (source) return parseGroup("auth", authSchema, source);
  return (cache.auth ??= parseGroup("auth", authSchema, process.env));
}
