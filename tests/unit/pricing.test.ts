import { describe, expect, it } from "vitest";

import { searchSummary } from "@/lib/offers/search-summary";
import {
  PLANS,
  featuredBadge,
  formatEuros,
  priceView,
  savingsCents,
  type Plan,
} from "@/lib/pricing";

const plan = (id: string): Plan => {
  const found = PLANS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return found;
};
const text = (value: string | null) => value?.replace(/\s/g, " ") ?? null;

describe("prices (C113)", () => {
  it("keeps the owner's prices: 1 mois, 3 mois and À vie", () => {
    expect(PLANS.map((p) => [p.name, p.billing, p.priceCents])).toEqual([
      ["1 mois", "monthly", 1990],
      ["3 mois", "quarterly", 2990],
      ["À vie", "lifetime", 12000],
    ]);
  });

  it("shows the monthly plan with its price per day", () => {
    const view = priceView(plan("basic"));
    expect(view).toMatchObject({ mainCents: 1990, unit: "/mois", perMonthLabel: null });
    expect(text(view.perDayLabel)).toBe("soit 0,66 € par jour");
    expect(view.savingLabel).toBeNull();
  });

  it("brings the 3 months plan back to a month and says what it saves", () => {
    const view = priceView(plan("plus"));
    expect(view).toMatchObject({ mainCents: 2990, unit: "/3 mois" });
    expect(text(view.perMonthLabel)).toBe("soit 9,97 € par mois");
    expect(savingsCents(plan("plus"))).toBe(3 * 1990 - 2990);
    expect(text(view.savingLabel)).toBe("29,80 € de moins que 3 mois au mois");
    expect(view.billedLabel).toBe("renouvelé tous les 3 mois, sans engagement");
  });

  it("charges the lifetime plan once, without a renewal", () => {
    const view = priceView(plan("premium"));
    expect(view).toMatchObject({ mainCents: 12000, unit: "une fois", perDayLabel: null });
    expect(text(formatEuros(view.mainCents))).toBe("120,00 €");
    expect(view.billedLabel).toMatch(/un seul paiement/);
  });

  it("adds features from one plan to the next", () => {
    expect(plan("plus").features[0]?.label).toBe("Tout le forfait 1 mois");
    expect(plan("premium").features[0]?.label).toBe("Tout le forfait 3 mois");
    expect(
      plan("basic")
        .features.map((f) => f.label)
        .join(" "),
    ).not.toMatch(/lettre/i);
  });

  it('speaks to the student with "tu", like the rest of the funnel', () => {
    const copy = PLANS.flatMap((p) => [p.tagline, ...p.features.map((f) => f.label)]).join(" ");
    expect(copy).not.toMatch(/\bvotre\b|\bvos\b|\bvous\b/i);
  });
});

describe("featuredBadge", () => {
  it("recommends the second plan until enough students chose one", () => {
    expect(featuredBadge(null)).toEqual({ planId: "plus", label: "Recommandé" });
    expect(featuredBadge({ basic: 10, plus: 2, premium: 1 })).toEqual({
      planId: "plus",
      label: "Recommandé",
    });
  });

  it("names the most chosen plan once it is true", () => {
    expect(featuredBadge({ basic: 5, plus: 30, premium: 8 })).toEqual({
      planId: "plus",
      label: "Le plus choisi",
    });
    expect(featuredBadge({ basic: 40, plus: 12, premium: 3 }).planId).toBe("basic");
    expect(featuredBadge({ basic: 15, plus: 15, premium: 0 }).label).toBe("Recommandé");
  });
});

describe("searchSummary", () => {
  it("gives an internship or a student job the companies of the domain, no offers (C106)", () => {
    expect(searchSummary(37, 150, { companiesOnly: true })).toMatchObject({
      before: "On a trouvé ",
      highlight: "plusieurs entreprises",
      after: " de ton domaine près de chez toi",
    });
    expect(searchSummary(5, 1, { companiesOnly: true }).highlight).toBe("une entreprise");
    const empty = searchSummary(12, 0, { companiesOnly: true });
    expect(empty.highlight).toBe("lancée");
    for (const summary of [searchSummary(37, 150, { companiesOnly: true }), empty]) {
      expect(Object.values(summary).join(" ")).not.toMatch(/\d|offre/);
    }
  });

  it("says the offers come first, without ever saying how many (C104)", () => {
    expect(searchSummary(37, 150)).toEqual({
      before: "On a trouvé ",
      highlight: "plusieurs offres",
      after: " qui collent à ton profil",
      extra: "Et des entreprises qui recrutent des alternants près de chez toi.",
    });
    expect(searchSummary(1, 0)).toMatchObject({
      highlight: "une offre",
      after: " qui colle à ton profil",
    });
    expect(searchSummary(0, 1)).toMatchObject({
      highlight: "une entreprise",
      after: " qui recrute des alternants près de chez toi",
    });
    expect(searchSummary(0, 12).highlight).toBe("des entreprises");
  });

  it("never prints a figure before the plan is active", () => {
    for (const [offers, companies] of [
      [37, 150],
      [1, 0],
      [0, 12],
      [0, 0],
    ] as const) {
      const summary = searchSummary(offers, companies);
      const sentence = `${summary.before}${summary.highlight}${summary.after} ${summary.extra ?? ""}`;
      expect(sentence).not.toMatch(/\d/);
    }
  });

  it("never says that nothing was found", () => {
    const summary = searchSummary(0, 0);
    expect(`${summary.before}${summary.highlight}${summary.after} ${summary.extra}`).not.toMatch(
      /aucun|pas trouvé|0 offre/i,
    );
  });
});
