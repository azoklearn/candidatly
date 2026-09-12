import { describe, expect, it } from "vitest";

import { searchSummary } from "@/lib/offers/search-summary";
import {
  PLANS,
  annualCents,
  featuredBadge,
  formatEuros,
  priceView,
  type Plan,
} from "@/lib/pricing";

const plan = (id: string): Plan => {
  const found = PLANS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return found;
};
const text = (cents: number) => formatEuros(cents).replace(/\s/g, " ");

describe("prices", () => {
  it("keeps the owner's monthly prices, with two free months a year", () => {
    expect(PLANS.map((p) => p.monthlyCents)).toEqual([999, 1499, 1999]);
    expect(PLANS.map(annualCents)).toEqual([9990, 14990, 19990]);
  });

  it("shows the monthly price and its price per day", () => {
    expect(priceView(plan("plus"), "monthly")).toEqual({
      mainCents: 1499,
      struckCents: null,
      perDayCents: 50,
      billedLabel: null,
    });
    expect(priceView(plan("basic"), "monthly").perDayCents).toBe(33);
  });

  it("strikes the real monthly price next to the annual price per month", () => {
    const view = priceView(plan("plus"), "annual");
    expect(view.mainCents).toBe(1249);
    expect(view.struckCents).toBe(1499);
    expect(view.perDayCents).toBe(41);
    expect(view.billedLabel?.replace(/\s/g, " ")).toBe("facturé 149,90 € par an");
    expect(text(priceView(plan("premium"), "annual").mainCents)).toBe("16,66 €");
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
  it("counts the offers first, then the companies", () => {
    expect(searchSummary(37, 150)).toEqual({
      before: "Nous avons trouvé ",
      highlight: "37 offres",
      after: " qui correspondent à votre profil",
      extra: "Et 150 entreprises qui recrutent des alternants près de chez vous.",
    });
    expect(searchSummary(1, 0).after).toBe(" qui correspond à votre profil");
    expect(searchSummary(0, 1)).toMatchObject({
      highlight: "1 entreprise",
      after: " qui recrute des alternants près de chez vous",
    });
  });

  it("never says that nothing was found", () => {
    const summary = searchSummary(0, 0);
    expect(`${summary.before}${summary.highlight}${summary.after} ${summary.extra}`).not.toMatch(
      /aucun|pas trouvé|0 offre/i,
    );
  });
});
