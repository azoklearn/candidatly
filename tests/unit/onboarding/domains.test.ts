import { describe, expect, it } from "vitest";

import { PRESET_CITIES, findPresetCity, RADIUS_OPTIONS } from "@/lib/onboarding/cities";
import { findDomain, findDomainByLabel, JOB_DOMAINS } from "@/lib/onboarding/domains";

describe("questionnaire domains", () => {
  it("holds well formed ROME codes, without duplicates", () => {
    const seen = new Set<string>();
    for (const domain of JOB_DOMAINS) {
      expect(domain.codes.length).toBeGreaterThan(3);
      for (const code of domain.codes) {
        expect(code).toMatch(/^[A-Z]\d{4}$/);
        expect(seen.has(code)).toBe(false);
        seen.add(code);
      }
    }
  });

  it("finds a domain by its id and by the label stored on the profile", () => {
    const first = JOB_DOMAINS[0];
    expect(findDomain(first?.id)?.label).toBe(first?.label);
    expect(findDomainByLabel(first?.label)?.id).toBe(first?.id);
    // The account page lets students type their own words: no domain then.
    expect(findDomainByLabel("je ne sais pas encore")).toBeNull();
    expect(findDomain(null)).toBeNull();
  });
});

describe("preset cities", () => {
  it("gives coordinates and an INSEE code for each city", () => {
    for (const city of PRESET_CITIES) {
      expect(city.insee).toMatch(/^[0-9][0-9AB][0-9]{3}$/);
      expect(Math.abs(city.lat)).toBeGreaterThan(40);
      expect(Number.isFinite(city.lng)).toBe(true);
    }
    expect(new Set(PRESET_CITIES.map((city) => city.id)).size).toBe(PRESET_CITIES.length);
  });

  it("finds a city by its id only", () => {
    expect(findPresetCity("lyon")?.insee).toBe("69123");
    expect(findPresetCity("atlantis")).toBeNull();
    expect(RADIUS_OPTIONS).toContain(30);
  });
});
