import { describe, expect, it } from "vitest";
import { parseAllowlist } from "./allowlist.js";
import { EMAIL_NOT_ALLOWED, buildAuthOptions } from "./options.js";

const options = buildAuthOptions({
  db: /** @type {any} */ ({}), // the adapter is lazy; hooks are tested directly
  secret: "x".repeat(32),
  baseURL: "http://localhost:3000",
  google: { clientId: "id", clientSecret: "secret" },
  allowlist: parseAllowlist("chinmay@example.com,aryan@example.com"),
});
const createUser = options.databaseHooks.user.create.before;
const createSession = options.databaseHooks.session.create.before;

/** @param {{ email?: string } | null} user */
function ctxFor(user) {
  return { context: { internalAdapter: { findUserById: async () => user } } };
}

async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the hook to reject");
}

describe("auth options", () => {
  it("offers Google only, with verified email required, and no plugins", () => {
    expect(Object.keys(options.socialProviders)).toEqual(["google"]);
    expect(options.socialProviders.google.requireEmailVerification).toBe(true);
    expect(options.emailAndPassword).toBeUndefined();
    expect(options.plugins).toBeUndefined();
    expect(options.advanced.database.generateId).toBe("uuid");
  });
});

describe("user creation hook", () => {
  it("lets an allowlisted, verified Google account through", async () => {
    await expect(
      createUser({ email: "Chinmay@Example.com", emailVerified: true }, null),
    ).resolves.toBeUndefined();
  });

  it("refuses an email that isn't on the allowlist, with a redirectable code", async () => {
    const error = await rejection(
      createUser({ email: "stranger@example.com", emailVerified: true }, null),
    );
    expect(error.statusCode).toBe(403);
    expect(error.body.code).toBe(EMAIL_NOT_ALLOWED);
  });

  it("refuses an unverified email even if it's allowlisted", async () => {
    const error = await rejection(
      createUser({ email: "aryan@example.com", emailVerified: false }, null),
    );
    expect(error.body.code).toBe(EMAIL_NOT_ALLOWED);
  });
});

describe("session creation hook", () => {
  it("allows a session for a user who is still allowlisted", async () => {
    await expect(
      createSession({ userId: "u1" }, ctxFor({ email: "aryan@example.com" })),
    ).resolves.toBeUndefined();
  });

  it("blocks a user whose email was removed from the allowlist", async () => {
    const error = await rejection(
      createSession({ userId: "u1" }, ctxFor({ email: "removed@example.com" })),
    );
    expect(error.body.code).toBe(EMAIL_NOT_ALLOWED);
  });

  it("fails closed when the user can't be found or there is no context", async () => {
    expect(
      (await rejection(createSession({ userId: "u1" }, ctxFor(null)))).body
        .code,
    ).toBe(EMAIL_NOT_ALLOWED);
    expect(
      (await rejection(createSession({ userId: "u1" }, null))).body.code,
    ).toBe(EMAIL_NOT_ALLOWED);
  });
});
