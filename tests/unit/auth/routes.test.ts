import { describe, expect, it } from "vitest";

import { authRedirectBase, isAuthPage, isProtectedPath, safeNextPath } from "@/lib/auth/routes";

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/offers?page=2")).toBe("/offers?page=2");
    expect(safeNextPath("/onboarding/3")).toBe("/onboarding/3");
  });

  it("rejects absolute, protocol-relative and malformed destinations", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "offers",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(value)).toBe("/offers");
    }
  });

  it("uses the given fallback", () => {
    expect(safeNextPath(null, "/onboarding/1")).toBe("/onboarding/1");
  });
});

describe("route guards", () => {
  it("protects the signed-in area only", () => {
    expect(isProtectedPath("/offers")).toBe(true);
    expect(isProtectedPath("/offers/123")).toBe(true);
    expect(isProtectedPath("/onboarding/2")).toBe(true);
    expect(isProtectedPath("/offersx")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/auth/callback")).toBe(false);
  });

  it("recognises the auth pages", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/signup")).toBe(true);
    expect(isAuthPage("/login/extra")).toBe(false);
  });
});

describe("authRedirectBase", () => {
  it("sends visitors back to the site they are on", () => {
    expect(authRedirectBase("https://candidatly.vercel.app", "http://localhost:3000")).toBe(
      "https://candidatly.vercel.app",
    );
  });

  it("falls back on the configured site URL when the origin is missing or odd", () => {
    expect(authRedirectBase(null, "https://candidatly.fr/")).toBe("https://candidatly.fr");
    expect(authRedirectBase("null", "https://candidatly.fr")).toBe("https://candidatly.fr");
    expect(authRedirectBase("https://evil.example/path", "https://candidatly.fr")).toBe(
      "https://candidatly.fr",
    );
  });
});
