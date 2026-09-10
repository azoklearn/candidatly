import { describe, expect, it } from "vitest";

import { buildMatchRows, boundingBox } from "@/lib/matching/compute";
import { extractKeywords } from "@/lib/matching/score";
import { groupSearchKeys, toSearchKey } from "@/lib/offers/search-keys";
import { isRunFresh, SEARCH_TTL_MS } from "@/lib/offers/sync";

const NOW = new Date("2026-09-11T12:00:00Z");

describe("search keys", () => {
  it("normalises codes, rounds coordinates and bounds the radius", () => {
    const { key, params } = toSearchKey({
      romeCodes: ["M1855", "M1805", "M1855"],
      lat: 48.85661,
      lng: 2.35222,
      radiusKm: 250,
      diplomaLevel: "bac+3",
    });
    expect(key).toBe("rome=M1805,M1855|lat=48.86|lng=2.35|r=200|level=bac+3");
    expect(params).toEqual({
      romeCodes: ["M1805", "M1855"],
      latitude: 48.86,
      longitude: 2.35,
      radiusKm: 200,
      diplomaLevel: "bac+3",
    });
  });

  it("shares one search between neighbours with the same criteria", () => {
    const base = { romeCodes: ["M1805"], radiusKm: 30, diplomaLevel: null };
    const keys = groupSearchKeys([
      { userId: "a", lat: 45.7641, lng: 4.8359, ...base },
      { userId: "b", lat: 45.7598, lng: 4.8401, ...base },
      { userId: "c", lat: 43.6, lng: 1.44, ...base },
      { userId: "d", lat: 45.76, lng: 4.84, ...base, romeCodes: [] },
    ]);
    expect(keys.map((k) => k.userIds)).toEqual([["a", "b"], ["c"]]);
  });
});

describe("search cache", () => {
  it("reuses a successful search for 6 hours only", () => {
    const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
    expect(isRunFresh({ fetched_at: at(SEARCH_TTL_MS - 60_000), status_code: 200 }, NOW)).toBe(
      true,
    );
    expect(isRunFresh({ fetched_at: at(SEARCH_TTL_MS + 60_000), status_code: 200 }, NOW)).toBe(
      false,
    );
    expect(isRunFresh({ fetched_at: at(60_000), status_code: 429 }, NOW)).toBe(false);
    expect(isRunFresh(null, NOW)).toBe(false);
  });
});

describe("match rows", () => {
  const profile = {
    romeCodes: ["M1855"],
    lat: 48.8566,
    lng: 2.3522,
    radiusKm: 30,
    diplomaLevel: null,
    cvKeywords: extractKeywords("React TypeScript"),
  };
  const offer = {
    id: "o1",
    rome_codes: ["M1855"],
    lat: 48.87,
    lng: 2.31,
    diploma_level: 6,
    published_at: "2026-09-10T00:00:00Z",
    title: "Développeur React",
    description: "TypeScript",
  };

  it("keeps linked offers inside the radius only", () => {
    const rows = buildMatchRows(
      "u1",
      profile,
      [
        offer,
        { ...offer, id: "far", lat: 45.76, lng: 4.84 },
        { ...offer, id: "unrelated", rome_codes: ["A1101"] },
        { ...offer, id: "related", rome_codes: ["M1810"] },
      ],
      NOW,
    );
    expect(rows.map((row) => row.offer_id)).toEqual(["o1", "related"]);
    expect(rows[0]).toMatchObject({ user_id: "u1", offer_id: "o1" });
    expect(rows[0]?.score).toBeGreaterThan(rows[1]?.score ?? 100);
  });

  it("computes a bounding box that contains the radius", () => {
    const box = boundingBox(48.8566, 2.3522, 30);
    expect(box.maxLat - box.minLat).toBeCloseTo(0.54, 2);
    expect(box.maxLng - box.minLng).toBeGreaterThan(box.maxLat - box.minLat);
  });
});
