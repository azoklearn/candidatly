import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { USER_AGENT } from "@/lib/brand";
import { pickCompanyMatch } from "@/lib/enrichment/company-match";
import { publicExecutives } from "@/lib/enrichment/enrich-company";
import { searchCompanies } from "@/lib/enrichment/recherche-entreprises";

const BASE_URL = "https://recherche-entreprises.api.gouv.fr";
const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../../fixtures/recherche-entreprises/${name}`, import.meta.url), "utf8"),
  );

function fakeApi(body: unknown) {
  const calls: { url: URL; userAgent: string | null }[] = [];
  const fetchImpl = async (input: URL | string, init?: RequestInit) => {
    calls.push({
      url: new URL(String(input)),
      userAgent: new Headers(init?.headers).get("user-agent"),
    });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { calls, fetchImpl };
}

describe("searchCompanies on real responses", () => {
  it("searches a SIRET directly and matches it with certainty", async () => {
    const api = fakeApi(fixture("siret-search.json"));
    const results = await searchCompanies(
      { siret: "81280923400030" },
      { baseUrl: BASE_URL, fetchImpl: api.fetchImpl },
    );
    expect(api.calls[0]?.url.searchParams.get("q")).toBe("81280923400030");
    expect(api.calls[0]?.url.searchParams.get("code_postal")).toBeNull();
    expect(api.calls[0]?.userAgent).toBe(USER_AGENT);
    const match = pickCompanyMatch(
      { siret: "81280923400030", name: null, postalCode: null },
      results,
    );
    expect(match?.record.siren).toBe("812809234");
    expect(match?.confidence).toBe(1);
  });

  it("searches a name within a postal code and scores the match itself", async () => {
    const api = fakeApi(fixture("name-search.json"));
    const results = await searchCompanies(
      { name: "Boulangerie du Nil", postalCode: "75011" },
      { baseUrl: BASE_URL, fetchImpl: api.fetchImpl },
    );
    const params = api.calls[0]?.url.searchParams;
    expect(params?.get("q")).toBe("Boulangerie du Nil");
    expect(params?.get("code_postal")).toBe("75011");
    expect(params?.get("etat_administratif")).toBe("A");
    const match = pickCompanyMatch(
      { siret: null, name: "Boulangerie du Nil", postalCode: "75011" },
      results,
    );
    expect(match?.establishment.code_postal).toBe("75011");
    expect(match?.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("never keeps executives' birth dates and shows natural persons by name and role only", async () => {
    const api = fakeApi(fixture("siret-search.json"));
    const [record] = await searchCompanies(
      { siret: "81280923400030" },
      { baseUrl: BASE_URL, fetchImpl: api.fetchImpl },
    );
    expect(JSON.stringify(record)).not.toMatch(/naissance|nationalite/);
    const executives = record ? publicExecutives(record) : [];
    for (const executive of executives) {
      expect(Object.keys(executive).sort()).toEqual(["name", "role"]);
      expect(executive.name).not.toMatch(/\d/);
    }
  });

  it("does not call the API without a SIRET or a usable name", async () => {
    const api = fakeApi({ results: [] });
    expect(
      await searchCompanies({ name: "ab" }, { baseUrl: BASE_URL, fetchImpl: api.fetchImpl }),
    ).toEqual([]);
    expect(api.calls).toHaveLength(0);
  });
});
