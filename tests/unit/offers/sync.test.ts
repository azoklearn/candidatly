import { describe, expect, it } from "vitest";

import { uniqueByExternalId } from "@/lib/offers/sync";

describe("uniqueByExternalId", () => {
  it("keeps the first row of each external id", () => {
    const rows = [
      { external_id: "France Travail:6735532", title: "first" },
      { external_id: "PASS:A-2026-234075", title: "other" },
      { external_id: "France Travail:6735532", title: "repeat" },
    ];
    expect(uniqueByExternalId(rows).map((row) => row.title)).toEqual(["first", "other"]);
  });
});
