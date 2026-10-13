// The ALLOWED_EMAILS allowlist (docs/ARCHITECTURE.md §4.1). Pure, so it's easy to test and
// can be used from the auth config, the viewer check and the Better Auth CLI config alike.
// Emails are compared exactly after trimming and lowercasing: no dot or "+tag" folding.

const EMAIL_SHAPE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/**
 * @param {unknown} email
 * @returns {string} trimmed, lowercased email, or "" when not a string
 */
export function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/**
 * Parse a comma-separated allowlist, e.g. "a@x.com, B@y.com".
 * @param {string | undefined} raw
 * @returns {ReadonlySet<string>}
 */
export function parseAllowlist(raw) {
  const entries = String(raw ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  if (entries.length === 0) {
    throw new Error("ALLOWED_EMAILS must list at least one email address");
  }
  const malformed = entries.filter((entry) => !EMAIL_SHAPE.test(entry));
  if (malformed.length > 0) {
    throw new Error(
      `ALLOWED_EMAILS has ${malformed.length} malformed entr${malformed.length === 1 ? "y" : "ies"}`,
    );
  }
  return new Set(entries);
}

/**
 * @param {ReadonlySet<string>} allowlist from parseAllowlist
 * @param {unknown} email
 */
export function isEmailAllowed(allowlist, email) {
  const normalized = normalizeEmail(email);
  return normalized !== "" && allowlist.has(normalized);
}
