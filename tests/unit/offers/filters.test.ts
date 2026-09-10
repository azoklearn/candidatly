import { describe, expect, it } from "vitest";

import { applyOfferFilters, parseOfferFilters } from "@/lib/offers/filters";

const now = new Date("2026-09-11T12:00:00Z").getTime();
const item = (
  status: string,
  distanceKm: number | null,
  published_at: string | null,
  company_name: string | null,
) => ({
  status,
  distanceKm,
  offer: { published_at, company_name },
});
const items = [
  item("new", 5, "2026-09-10T00:00:00Z", "Boulangerie Martin"),
  item("saved", 25, "2026-08-01T00:00:00Z", "Mairie de Lyon"),
  item("new", null, null, null),
];

describe("offer filters", () => {
  it("parses the query string and ignores invalid values", () => {
    expect(
      parseOfferFilters({ km: "20", days: "abc", company: "  Mairie ", view: "saved" }),
    ).toEqual({
      maxKm: 20,
      maxDays: null,
      company: "mairie",
      savedOnly: true,
    });
  });

  it("filters by distance, date, company and saved status", () => {
    const run = (params: Parameters<typeof parseOfferFilters>[0]) =>
      applyOfferFilters(items, parseOfferFilters(params), now);
    expect(run({})).toHaveLength(3);
    expect(run({ km: "10" })).toEqual([items[0], items[2]]);
    expect(run({ days: "7" })).toEqual([items[0], items[2]]);
    expect(run({ company: "lyon" })).toEqual([items[1]]);
    expect(run({ view: "saved" })).toEqual([items[1]]);
  });
});
