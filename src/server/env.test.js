import { describe, expect, it } from "vitest";
import { authEnv, dbEnv } from "./env.js";

const validAuth = {
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  ALLOWED_EMAILS: "a@example.com",
};

describe("dbEnv", () => {
  it("accepts postgres and postgresql URLs", () => {
    for (const url of [
      "postgresql://yoddha:yoddha@localhost:5433/yoddha_dev",
      "postgres://u:p@ep-x-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require",
    ]) {
      expect(dbEnv({ DATABASE_URL: url }).DATABASE_URL).toBe(url);
    }
  });

  it("names the variable but never echoes its value", () => {
    const secretish = "mysql://user:hunter2@host/db";
    let message = "";
    try {
      dbEnv({ DATABASE_URL: secretish });
    } catch (error) {
      message = String(error);
    }
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).toMatch(/\.env\.example/);
    expect(message).not.toContain("hunter2");
  });

  it("fails when missing", () => {
    expect(() => dbEnv({})).toThrow(/DATABASE_URL/);
  });
});

describe("authEnv", () => {
  it("accepts a complete auth config", () => {
    expect(authEnv(validAuth).GOOGLE_CLIENT_ID).toBe("client-id");
  });

  it("rejects a short secret and a missing allowlist", () => {
    const { ALLOWED_EMAILS: _omit, ...withoutAllowlist } = validAuth;
    expect(() =>
      authEnv({ ...validAuth, BETTER_AUTH_SECRET: "short" }),
    ).toThrow(/BETTER_AUTH_SECRET must be at least 32 characters/);
    expect(() => authEnv(withoutAllowlist)).toThrow(/ALLOWED_EMAILS/);
  });

  it("rejects a non-http base URL", () => {
    expect(() => authEnv({ ...validAuth, BETTER_AUTH_URL: "ftp://x" })).toThrow(
      /BETTER_AUTH_URL/,
    );
  });
});
