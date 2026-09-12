import { describe, expect, it } from "vitest";

import { toTeaserCards, type TeaserRow } from "@/lib/offers/teaser";

const NOW = new Date("2026-09-12T12:00:00Z");

const row = (overrides: Partial<TeaserRow["offer"]> = {}, score = 88): TeaserRow => ({
  score,
  offer: {
    location_label: "10 RUE DE RIVOLI 75004 PARIS",
    contract_types: ["apprentissage"],
    published_at: "2026-09-11T09:00:00Z",
    ...overrides,
  },
});

describe("toTeaserCards", () => {
  it("keeps only what can be shown before paying", () => {
    expect(toTeaserCards([row()], 4, NOW)).toEqual([
      { city: "Paris", contract: "Apprentissage", freshness: "hier", score: 88 },
    ]);
  });

  it("never carries the title or the employer", () => {
    const [card] = toTeaserCards([row()], 4, NOW);
    expect(Object.keys(card ?? {}).sort()).toEqual(["city", "contract", "freshness", "score"]);
  });

  it("shows at most the asked number of cards", () => {
    const rows = Array.from({ length: 9 }, () => row());
    expect(toTeaserCards(rows, 4, NOW)).toHaveLength(4);
  });

  it("survives an offer without place or date", () => {
    expect(toTeaserCards([row({ location_label: null, published_at: null }, 61)], 4, NOW)).toEqual([
      { city: null, contract: "Apprentissage", freshness: null, score: 61 },
    ]);
  });
});
