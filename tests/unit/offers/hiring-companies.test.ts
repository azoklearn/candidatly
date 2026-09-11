import { describe, expect, it } from "vitest";

import {
  formatHeadcount,
  rankHiringCompanies,
  sectorLabel,
  type HiringCompanyRow,
} from "@/lib/offers/hiring-companies";

const PARIS = { lat: 48.8566, lng: 2.3522 };

function row(overrides: Partial<HiringCompanyRow>): HiringCompanyRow {
  return {
    id: "id",
    name: "Entreprise",
    naf_code: null,
    naf_label: null,
    headcount: null,
    address: null,
    lat: null,
    lng: null,
    apply_url: null,
    ...overrides,
  };
}

describe("formatHeadcount", () => {
  it("turns the source ranges into sentences", () => {
    expect(formatHeadcount("10-19")).toBe("10 à 19 salariés");
    expect(formatHeadcount("1-1")).toBe("1 salarié");
    expect(formatHeadcount("0-0")).toBeNull();
    expect(formatHeadcount("inconnu")).toBeNull();
    expect(formatHeadcount(null)).toBeNull();
  });
});

describe("sectorLabel", () => {
  it("prefers the source label, then the NAF nomenclature", () => {
    expect(sectorLabel("62.01Z", "Programmation informatique")).toBe("Programmation informatique");
    expect(sectorLabel("6201Z", null)).toBe("Programmation informatique");
    expect(sectorLabel("99.99Z", null)).toBeNull();
    expect(sectorLabel(null, null)).toBeNull();
  });
});

describe("rankHiringCompanies", () => {
  it("puts the closest companies first and the ones without a position last", () => {
    const ranked = rankHiringCompanies(
      [
        row({ id: "far", name: "Lyon SA", lat: 45.764, lng: 4.8357 }),
        row({ id: "unknown", name: "Aucune position" }),
        row({
          id: "near",
          name: "Paris SAS",
          lat: 48.86,
          lng: 2.35,
          address: "1 rue X 75004 PARIS",
        }),
      ],
      PARIS,
    );
    expect(ranked.map((company) => company.id)).toEqual(["near", "far", "unknown"]);
    expect(ranked[0]?.city).toBe("Paris");
    expect(ranked[0]?.distanceKm).toBeLessThan(1);
    expect(ranked[2]?.distanceKm).toBeNull();
  });

  it("keeps at most the requested number of companies", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row({ id: String(i), name: `E${i}` }));
    expect(rankHiringCompanies(rows, PARIS, 5)).toHaveLength(5);
  });
});
