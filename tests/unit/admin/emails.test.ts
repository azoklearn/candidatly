import { describe, expect, it } from "vitest";

import { isAdminEmail, parseAdminEmails } from "@/lib/admin/emails";

describe("admin emails", () => {
  it("reads a list written with commas, spaces or both", () => {
    const admins = parseAdminEmails(" Owner@Example.com, second@example.com\nthird@example.com ");
    expect([...admins]).toEqual(["owner@example.com", "second@example.com", "third@example.com"]);
  });

  it("ignores anything that is not an address", () => {
    expect([...parseAdminEmails("yes@example.com,,oops")]).toEqual(["yes@example.com"]);
    expect(parseAdminEmails(undefined).size).toBe(0);
  });

  it("matches without case, and closes the page when the list is empty", () => {
    const admins = parseAdminEmails("owner@example.com");
    expect(isAdminEmail("OWNER@example.com", admins)).toBe(true);
    expect(isAdminEmail(" owner@example.com ", admins)).toBe(true);
    expect(isAdminEmail("someone@example.com", admins)).toBe(false);
    expect(isAdminEmail(null, admins)).toBe(false);
    expect(isAdminEmail("owner@example.com", parseAdminEmails(""))).toBe(false);
  });
});
