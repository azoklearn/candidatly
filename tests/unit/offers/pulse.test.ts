import { describe, expect, it } from "vitest";

import { pulseSentence, searchPulse } from "@/lib/offers/pulse";

const NOW = new Date("2026-11-06T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

describe("searchPulse", () => {
  it("counts the offers published over the last week and dates the freshest one", () => {
    const pulse = searchPulse(
      [
        { published_at: hoursAgo(3) },
        { published_at: hoursAgo(50) },
        { published_at: hoursAgo(24 * 6) },
        { published_at: hoursAgo(24 * 30) },
      ],
      NOW,
    );
    expect(pulse).toEqual({ lastWeek: 3, newestLabel: "il y a 3 heures" });
  });

  it("ignores offers without a usable date", () => {
    const pulse = searchPulse([{ published_at: null }, { published_at: "pas une date" }], NOW);
    expect(pulse).toEqual({ lastWeek: 0, newestLabel: null });
  });

  it("reads the near past in hours, then in days", () => {
    expect(searchPulse([{ published_at: hoursAgo(0.2) }], NOW).newestLabel).toBe("à l’instant");
    expect(searchPulse([{ published_at: hoursAgo(1) }], NOW).newestLabel).toBe("il y a 1 heure");
    expect(searchPulse([{ published_at: hoursAgo(30) }], NOW).newestLabel).toBe("hier");
    expect(searchPulse([{ published_at: hoursAgo(24 * 4) }], NOW).newestLabel).toBe(
      "il y a 4 jours",
    );
  });

  it("treats a date in the future as just published, never as negative", () => {
    expect(searchPulse([{ published_at: hoursAgo(-5) }], NOW)).toEqual({
      lastWeek: 1,
      newestLabel: "à l’instant",
    });
  });
});

describe("pulseSentence", () => {
  it("says only what was measured", () => {
    expect(pulseSentence({ lastWeek: 4, newestLabel: "il y a 2 heures" })).toBe(
      "4 offres de ta sélection publiées ces 7 derniers jours · la plus récente il y a 2 heures",
    );
    expect(pulseSentence({ lastWeek: 1, newestLabel: null })).toBe(
      "1 offre de ta sélection publiée ces 7 derniers jours",
    );
    expect(pulseSentence({ lastWeek: 0, newestLabel: "il y a 20 jours" })).toBe(
      "la plus récente il y a 20 jours",
    );
  });

  it("stays silent when there is nothing to say", () => {
    expect(pulseSentence({ lastWeek: 0, newestLabel: null })).toBeNull();
  });
});
