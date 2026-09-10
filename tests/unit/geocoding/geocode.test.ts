import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { isSearchableQuery, resolvePlace, searchPlaces } from "@/lib/geocoding/geocode";
import type { FetchLike } from "@/lib/http/fetch-json";

const BASE_URL = "https://data.geopf.fr/geocodage";
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../fixtures/geocoding/${name}`, import.meta.url), "utf8"));

function respond(body: unknown) {
  const urls: URL[] = [];
  const fetchImpl: FetchLike = async (input) => {
    urls.push(new URL(String(input)));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, urls };
}

describe("searchPlaces", () => {
  it("maps GeoJSON features, reading coordinates as [longitude, latitude]", async () => {
    const { fetchImpl, urls } = respond(fixture("search.json"));
    const places = await searchPlaces("8 bd du port", { baseUrl: BASE_URL, fetchImpl });
    expect(urls[0]?.pathname).toBe("/geocodage/search");
    expect(urls[0]?.searchParams.get("q")).toBe("8 bd du port");
    expect(urls[0]?.searchParams.get("autocomplete")).toBe("1");
    expect(places[0]).toMatchObject({
      label: "8 Boulevard du Port 95000 Cergy",
      lat: 49.031624,
      lng: 2.062821,
      citycode: "95127",
      postcode: "95000",
      city: "Cergy",
      type: "housenumber",
    });
  });

  it("keeps the arrondissement code in Paris", async () => {
    const { fetchImpl } = respond(fixture("paris-arrondissement.json"));
    const [first] = await searchPlaces("10 rue de rivoli paris", { baseUrl: BASE_URL, fetchImpl });
    expect(first?.citycode).toMatch(/^751\d{2}$/);
  });

  it("filters by type and skips malformed features", async () => {
    const body = fixture("municipality.json") as { features: unknown[] };
    const { fetchImpl, urls } = respond({
      ...body,
      features: [...body.features, { type: "Feature" }],
    });
    const places = await searchPlaces("lyon", {
      baseUrl: BASE_URL,
      fetchImpl,
      type: "municipality",
    });
    expect(urls[0]?.searchParams.get("type")).toBe("municipality");
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ label: "Lyon", citycode: "69123", lat: 45.758, lng: 4.835 });
  });

  it("does not call the API for short or invalid queries", async () => {
    const { fetchImpl, urls } = respond({ features: [] });
    expect(await searchPlaces("ly", { baseUrl: BASE_URL, fetchImpl })).toEqual([]);
    expect(await searchPlaces("-- paris", { baseUrl: BASE_URL, fetchImpl })).toEqual([]);
    expect(urls).toHaveLength(0);
    expect(isSearchableQuery("Évry")).toBe(true);
  });
});

describe("resolvePlace", () => {
  it("accepts a label that resolves to the same city", async () => {
    const { fetchImpl, urls } = respond(fixture("municipality.json"));
    const place = await resolvePlace(
      { label: "Lyon", citycode: "69123" },
      { baseUrl: BASE_URL, fetchImpl },
    );
    expect(place?.citycode).toBe("69123");
    expect(urls[0]?.searchParams.get("autocomplete")).toBe("0");
    expect(urls[0]?.searchParams.get("limit")).toBe("1");
  });

  it("rejects a tampered city code", async () => {
    const { fetchImpl } = respond(fixture("municipality.json"));
    expect(
      await resolvePlace({ label: "Lyon", citycode: "75056" }, { baseUrl: BASE_URL, fetchImpl }),
    ).toBeNull();
  });
});

describe("searchPlaces duplicates", () => {
  it("drops a place returned twice by the geocoder", async () => {
    const body = JSON.parse(
      readFileSync(new URL("../../fixtures/geocoding/search.json", import.meta.url), "utf8"),
    );
    body.features = [body.features[0], body.features[0]];
    const fetchImpl = async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    expect(await searchPlaces("lyon", { baseUrl: BASE_URL, fetchImpl })).toHaveLength(1);
  });
});
