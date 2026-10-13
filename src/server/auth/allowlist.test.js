import { describe, expect, it } from "vitest";
import { isEmailAllowed, normalizeEmail, parseAllowlist } from "./allowlist.js";

describe("parseAllowlist", () => {
  it("trims, lowercases and ignores empty entries", () => {
    const list = parseAllowlist(" Chinmay@Example.com , aryan@example.com,,");
    expect([...list]).toEqual(["chinmay@example.com", "aryan@example.com"]);
  });

  it("refuses an empty allowlist rather than letting nobody (or everybody) in", () => {
    expect(() => parseAllowlist("")).toThrow(/at least one/);
    expect(() => parseAllowlist(" , ")).toThrow(/at least one/);
    expect(() => parseAllowlist(undefined)).toThrow(/at least one/);
  });

  it("refuses malformed entries without echoing them", () => {
    expect(() => parseAllowlist("ok@example.com, not-an-email")).toThrow(
      /1 malformed entry/,
    );
    expect(() => parseAllowlist("a b@example.com")).toThrow(/malformed/);
  });
});

describe("isEmailAllowed", () => {
  const list = parseAllowlist("chinmay@example.com");

  it("matches case-insensitively after trimming", () => {
    expect(isEmailAllowed(list, "Chinmay@Example.COM ")).toBe(true);
  });

  it("does not fold dots or +tags (exact address only)", () => {
    expect(isEmailAllowed(list, "chin.may@example.com")).toBe(false);
    expect(isEmailAllowed(list, "chinmay+x@example.com")).toBe(false);
  });

  it("rejects missing or non-string emails", () => {
    for (const email of [undefined, null, "", 42]) {
      expect(isEmailAllowed(list, email)).toBe(false);
    }
  });
});

describe("normalizeEmail", () => {
  it("returns an empty string for non-strings", () => {
    expect(normalizeEmail(null)).toBe("");
  });
});
