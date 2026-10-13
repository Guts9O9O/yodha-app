import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Wiring check: the app's Better Auth instance builds from env with the generated auth tables.
// No database connection is made (the pool connects lazily on first query).
// Better Auth is imported once, in beforeAll: a cold import is slow, and doing it inside a test
// made that test flaky under the full parallel suite.
describe("getAuth", () => {
  /** @type {typeof import("./auth.js")} */
  let mod;

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5433/yoddha_test");
    vi.stubEnv("BETTER_AUTH_SECRET", "s".repeat(32));
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
    vi.stubEnv("ALLOWED_EMAILS", "Chinmay@Example.com, aryan@example.com");
    mod = await import("./auth.js");
  }, 30_000);

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("builds one Google-only instance with an HTTP handler", () => {
    const auth = mod.getAuth();
    expect(typeof auth.handler).toBe("function");
    expect(Object.keys(auth.options.socialProviders)).toEqual(["google"]);
    expect(mod.getAuth()).toBe(auth);
  });

  it("parses the allowlist from ALLOWED_EMAILS", () => {
    expect([...mod.getAllowlist()]).toEqual([
      "chinmay@example.com",
      "aryan@example.com",
    ]);
  });
});
