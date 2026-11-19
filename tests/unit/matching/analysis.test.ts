import { describe, expect, it } from "vitest";

import { analyseMatch, missingSkills, type AnalysisInput } from "@/lib/matching/analysis";
import { classifyNoise } from "@/lib/offers/noise";

const input = (
  patch: Partial<AnalysisInput> = {},
  reasons: Partial<AnalysisInput["reasons"]> = {},
) =>
  ({
    reasons: {
      rome: "exact",
      distanceKm: 4,
      diploma: "exact",
      freshnessDays: 2,
      keywords: ["react", "typescript", "sql"],
      ...reasons,
    },
    radiusKm: 30,
    profileLevel: 6,
    offerLevel: 6,
    desiredSkills: [],
    hasCv: true,
    cvText: "Développeuse web : React, TypeScript, SQL. Projets en équipe.",
    noiseKind: null,
    ...patch,
  }) satisfies AnalysisInput;
const shorts = (points: { short: string }[]) => points.map((point) => point.short);

describe("match analysis (C120)", () => {
  it("lists what fits when everything lines up, with no gap and no advice", () => {
    const analysis = analyseMatch(input());
    expect(shorts(analysis.fits)).toEqual([
      "Votre métier",
      "À 4 km",
      "Votre niveau",
      "Récente",
      "3 mots de votre CV",
    ]);
    expect(analysis.gaps).toEqual([]);
    expect(analysis.tips).toEqual([]);
  });

  it("names each gap and gives one piece of advice for it", () => {
    const analysis = analyseMatch(
      input(
        { offerLevel: 7 },
        { rome: "related", distanceKm: 27, diploma: "adjacent", freshnessDays: 45, keywords: [] },
      ),
    );
    expect(shorts(analysis.gaps)).toEqual([
      "Métier proche",
      "À 27 km",
      "Niveau au-dessus",
      "Ancienne",
      "Aucun mot en commun",
    ]);
    expect(analysis.fits).toEqual([]);
    expect(analysis.tips.length).toBe(5);
    expect(analysis.tips.join(" ")).toMatch(/trajet/);
  });

  it("tells a level below from a level above, and says so when it cannot tell", () => {
    const below = analyseMatch(input({ offerLevel: 4 }, { diploma: "mismatch" }));
    expect(below.gaps[0]?.short).toBe("Niveau en dessous");
    expect(below.gaps[0]?.text).toMatch(/nettement en dessous/);
    const unknown = analyseMatch(input({ profileLevel: null }, { diploma: "adjacent" }));
    expect(unknown.gaps[0]?.short).toBe("Niveau différent");
    const unspecified = analyseMatch(input({}, { diploma: "unspecified" }));
    expect(unspecified.gaps[0]?.short).toBe("Niveau non précisé");
  });

  it("lists the skills asked by the offer that the CV does not mention, never inventing any", () => {
    const desired = ["Maîtrise de React", "Connaissance de Docker", "Anglais professionnel"];
    expect(missingSkills(desired, input().cvText)).toEqual([
      "Connaissance de Docker",
      "Anglais professionnel",
    ]);
    const analysis = analyseMatch(input({ desiredSkills: desired }));
    expect(analysis.gaps.at(-1)?.short).toBe("2 compétences absentes");
    expect(analysis.tips.at(-1)).toMatch(/ne les inventez pas/);
    // Without a CV nothing can be called missing.
    expect(missingSkills(desired, null)).toEqual([]);
  });

  it("says when the score cannot see the skills, for an account without a CV", () => {
    const analysis = analyseMatch(input({ hasCv: false, cvText: null }, { keywords: [] }));
    expect(shorts(analysis.gaps)).toContain("Pas de CV");
    expect(analysis.tips.join(" ")).toMatch(/Ajoutez votre CV/);
  });

  it("warns when a school, a training body or an agency is behind the offer", () => {
    expect(analyseMatch(input({ noiseKind: "school" })).gaps.at(-1)?.short).toBe(
      "Gérée par une école",
    );
    expect(analyseMatch(input({ noiseKind: "staffing" })).gaps.at(-1)?.short).toBe("Agence");
    expect(analyseMatch(input({ noiseKind: "training" })).gaps.at(-1)?.short).toBe(
      "Organisme de formation",
    );
  });

  it("promises nothing and speaks to the student with « vous »", () => {
    const analysis = analyseMatch(
      input({ noiseKind: "school", desiredSkills: ["Docker"] }, { rome: "related", keywords: [] }),
    );
    const words = [...analysis.fits, ...analysis.gaps].map((p) => p.text).concat(analysis.tips);
    expect(words.join(" ")).not.toMatch(/garanti|%|\btu\b|\bton\b|\bta\b|\btes\b/i);
  });
});

describe("noise filter (C120)", () => {
  it("flags an offer managed by a school first", () => {
    expect(classifyNoise({ isDelegated: true, nafCode: "62.02A", companyName: "ACME" })).toBe(
      "school",
    );
  });

  it("flags staffing agencies by activity code or by name", () => {
    expect(classifyNoise({ isDelegated: false, nafCode: "78.20Z", companyName: "WEFIND" })).toBe(
      "staffing",
    );
    expect(classifyNoise({ isDelegated: false, nafCode: null, companyName: "ADECCO" })).toBe(
      "staffing",
    );
    expect(classifyNoise({ isDelegated: false, companyName: "Proman Intérim Lyon" })).toBe(
      "staffing",
    );
  });

  it("flags training bodies by activity code or by name", () => {
    expect(classifyNoise({ isDelegated: false, nafCode: "8559A", companyName: "X" })).toBe(
      "training",
    );
    expect(classifyNoise({ isDelegated: false, companyName: "Campus formation et métiers" })).toBe(
      "training",
    );
  });

  it("leaves ordinary employers alone, even when a word looks close", () => {
    expect(
      classifyNoise({ isDelegated: false, nafCode: "61.20Z", companyName: "ATC FRANCE" }),
    ).toBe(null);
    expect(
      classifyNoise({ isDelegated: false, companyName: "Information Systems Lyon" }),
    ).toBeNull();
    expect(classifyNoise({ isDelegated: false, companyName: null })).toBeNull();
  });
});
