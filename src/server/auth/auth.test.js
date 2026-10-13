import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Wiring check: the app's Better Auth instance builds from env with the generated auth tables.
// No database connection is made (the pool connects lazily on first query).
describe("getAuth", () => {
  beforeEach(() => {
    vi.resetModules(); // env and the instance are cached per module
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5433/yoddha_test");
    vi.stubEnv("BETTER_AUTH_SECRET", "s".repeat(32));
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
    vi.stubEnv("ALLOWED_EMAILS", "Chinmay@Example.com, aryan@example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds one Google-only instance with an HTTP handler", async () => {
    const { getAuth } = await import("./auth.js");
    const auth = getAuth();
    expect(typeof auth.handler).toBe("function");
    expect(Object.keys(auth.options.socialProviders)).toEqual(["google"]);
    expect(getAuth()).toBe(auth);
  });

  it("parses the allowlist from ALLOWED_EMAILS", async () => {
    const { getAllowlist } = await import("./auth.js");
    expect([...getAllowlist()]).toEqual([
      "chinmay@example.com",
      "aryan@example.com",
    ]);
  });
});
