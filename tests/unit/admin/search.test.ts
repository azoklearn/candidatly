import { describe, expect, it } from "vitest";

import { matchesAccountQuery, parseUserId } from "@/lib/admin/search";

const account = { email: "camille@example.com", name: "Camille Hélène", location: "Lyon 3e" };

describe("admin account search (C112)", () => {
  it("keeps everyone without a query", () => {
    expect(matchesAccountQuery(account, "")).toBe(true);
    expect(matchesAccountQuery(account, "   ")).toBe(true);
    expect(matchesAccountQuery(account, undefined)).toBe(true);
  });

  it("matches the address, the name and the city, without case or accents", () => {
    expect(matchesAccountQuery(account, "CAMILLE@")).toBe(true);
    expect(matchesAccountQuery(account, "helene")).toBe(true);
    expect(matchesAccountQuery(account, "lyon")).toBe(true);
    expect(matchesAccountQuery(account, "paris")).toBe(false);
    expect(matchesAccountQuery({ email: null, name: null, location: null }, "a")).toBe(false);
  });

  it("accepts only uuids as account ids", () => {
    expect(parseUserId("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe(
      "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    );
    expect(parseUserId("../etc")).toBeNull();
    expect(parseUserId("1234")).toBeNull();
  });
});
