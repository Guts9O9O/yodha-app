import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy.js";

describe("proxy (UX redirect only)", () => {
  it("sends visitors without a session cookie to /sign-in", () => {
    const response = proxy(new Request("http://localhost:3000/training"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in",
    );
  });

  it("lets requests with a session cookie through (the page still verifies it)", () => {
    const response = proxy(
      new Request("http://localhost:3000/training", {
        headers: { cookie: "better-auth.session_token=opaque-token" },
      }),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("never runs on the sign-in page, the auth API or static files", () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`);
    for (const path of [
      "/sign-in",
      "/api/auth/callback/google",
      "/_next/static/x.js",
      "/favicon.ico",
      "/logo.svg",
    ]) {
      expect(pattern.test(path), path).toBe(false);
    }
    for (const path of ["/", "/training", "/nutrition/2026-10-14"]) {
      expect(pattern.test(path), path).toBe(true);
    }
  });
});
