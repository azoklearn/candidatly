import { describe, expect, it } from "vitest";

import { buildCompanySummary, firstSentences } from "@/lib/enrichment/company-summary";

describe("buildCompanySummary", () => {
  it("prefers the company's own description and says where it comes from", () => {
    const summary = buildCompanySummary({
      nafLabel: "Conseil en systèmes et logiciels informatiques",
      headcountLabel: "6 à 9 salariés",
      creationYear: 2022,
      city: "PARIS 13",
      website: {
        description:
          "Holis mesure l'impact environnemental des produits. Notre plateforme accompagne les marques. Troisième phrase.",
        sources: ["https://www.holis.eco/"],
      },
      offerDescription: null,
    });
    expect(summary.what_they_do).toBe(
      "Holis mesure l'impact environnemental des produits. Notre plateforme accompagne les marques.",
    );
    expect(summary.what_they_do_source).toBe("website");
    expect(summary.size_and_context).toBe(
      "Entreprise de 6 à 9 salariés, créée en 2022, basée à Paris 13.",
    );
    expect(summary.recent_or_notable).toEqual([]);
    expect(summary.hooks_for_candidate).toHaveLength(2);
    expect(summary.sources).toEqual(["https://www.holis.eco/"]);
    expect(summary.generator).toBe("rules");
  });

  it("falls back on the offer, then on the registry, and stays empty without data", () => {
    const fromRegistry = buildCompanySummary({
      nafLabel: "Boulangerie et boulangerie-pâtisserie",
      headcountLabel: "sans salarié",
      creationYear: null,
      city: null,
      website: null,
      offerDescription: null,
    });
    expect(fromRegistry.what_they_do).toBe(
      "Activité déclarée : boulangerie et boulangerie-pâtisserie.",
    );
    expect(fromRegistry.size_and_context).toBe("Entreprise sans salarié.");
    const empty = buildCompanySummary({
      nafLabel: null,
      headcountLabel: null,
      creationYear: null,
      city: null,
      website: null,
      offerDescription: null,
    });
    expect(empty).toMatchObject({
      what_they_do: "",
      what_they_do_source: "none",
      size_and_context: "",
      hooks_for_candidate: [],
    });
  });

  it("cuts long texts on a sentence boundary", () => {
    expect(firstSentences("Une. Deux. Trois.")).toBe("Une. Deux.");
    expect(firstSentences("x".repeat(400)).length).toBe(320);
  });
});
