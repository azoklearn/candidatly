import { describe, expect, it } from "vitest";

import {
  extractKeywords,
  haversineKm,
  scoreMatch,
  type MatchOffer,
  type MatchProfile,
} from "@/lib/matching/score";

const NOW = new Date("2026-09-11T12:00:00Z");
const PARIS = { lat: 48.8566, lng: 2.3522 };

const profile: MatchProfile = {
  romeCodes: ["M1855", "M1805"],
  ...PARIS,
  radiusKm: 30,
  diplomaLevel: "bac+3",
  cvKeywords: extractKeywords(
    "TypeScript React SQL TypeScript React Node.js Git Figma agilité React",
  ),
};

const offer: MatchOffer = {
  romeCodes: ["M1855"],
  lat: 48.8698,
  lng: 2.3075,
  diplomaLevel: 6,
  publishedAt: "2026-09-09T08:00:00Z",
  text: "Développeur web en alternance. Stack : React, TypeScript, Node.js, SQL. Méthode agilité.",
};

describe("haversineKm", () => {
  it("measures Paris to Lyon at about 392 km", () => {
    expect(haversineKm(PARIS, { lat: 45.764, lng: 4.8357 })).toBeCloseTo(392, -1);
  });
});

describe("extractKeywords", () => {
  it("ranks the most frequent meaningful words first", () => {
    expect(
      extractKeywords("React React TypeScript et le SQL de la base React TypeScript").slice(0, 3),
    ).toEqual(["react", "typescript", "base"]);
  });

  it("drops CV section words, diplomas and the student's name", () => {
    expect(
      extractKeywords(
        "Camille Martin\nEtudiante en BUT Informatique\nCompetences : TypeScript, React",
        {
          exclude: ["Camille", "Martin"],
        },
      ),
    ).toEqual(["informatique", "react", "typescript"]);
  });
});

describe("scoreMatch", () => {
  it("gives a high score to a close, fresh offer on the profile's code", () => {
    const result = scoreMatch(profile, offer, NOW);
    expect(result?.reasons).toMatchObject({ rome: "exact", diploma: "exact", freshnessDays: 2 });
    expect(result?.reasons.distanceKm).toBeGreaterThan(3);
    expect(result?.reasons.keywords).toEqual(
      expect.arrayContaining(["react", "typescript", "sql"]),
    );
    expect(result?.score).toBeGreaterThanOrEqual(85);
    expect(result?.score).toBeLessThanOrEqual(100);
  });

  it("ranks related codes, other levels and old offers lower", () => {
    const related = scoreMatch(profile, { ...offer, romeCodes: ["M1810"] }, NOW);
    const otherLevel = scoreMatch(profile, { ...offer, diplomaLevel: 4 }, NOW);
    const old = scoreMatch(profile, { ...offer, publishedAt: "2026-06-01T00:00:00Z" }, NOW);
    const best = scoreMatch(profile, offer, NOW);
    expect(related?.reasons.rome).toBe("related");
    expect(otherLevel?.reasons.diploma).toBe("mismatch");
    expect(old?.reasons.points.freshness).toBe(0);
    for (const worse of [related, otherLevel, old])
      expect(worse?.score).toBeLessThan(best?.score ?? 0);
  });

  it("treats a missing offer level as unspecified", () => {
    expect(scoreMatch(profile, { ...offer, diplomaLevel: null }, NOW)?.reasons.diploma).toBe(
      "unspecified",
    );
  });

  it("excludes offers outside the radius or without coordinates", () => {
    expect(scoreMatch(profile, { ...offer, lat: 45.764, lng: 4.8357 }, NOW)).toBeNull();
    expect(scoreMatch(profile, { ...offer, lat: null, lng: null }, NOW)).toBeNull();
  });
});
