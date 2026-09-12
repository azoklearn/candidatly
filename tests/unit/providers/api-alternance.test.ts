import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { ExternalApiError, RateLimitedError, ValidationError } from "@/lib/errors";
import type { FetchLike } from "@/lib/http/fetch-json";
import { createLogger } from "@/lib/logger";
import {
  ApiAlternanceProvider,
  JobOfferReadSchema,
  extractPostalCode,
  normalizeJobOffer,
  toTargetDiplomaLevel,
} from "@/lib/providers/api-alternance";
import { toOfferRow } from "@/lib/providers/to-offer-row";

const KEY = "test-api-key-0123456789";
const OFFER_ID = "68f7bcfe49b8c5a9667fbcbf";
const PARIS = { latitude: 48.8566, longitude: 2.3522, radiusKm: 30 };
const silent = createLogger({}, { write: () => {} });

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../../fixtures/api-alternance/${name}`, import.meta.url), "utf8"),
  );
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function setup(...responses: Response[]) {
  const calls: Array<{ url: URL; init: RequestInit | undefined }> = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push({ url: new URL(String(input)), init });
    const next = responses.shift();
    if (!next) throw new Error("Unexpected extra request");
    return next;
  };
  const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
  const provider = new ApiAlternanceProvider({ apiKey: KEY, fetchImpl, sleep, logger: silent });
  return { provider, calls, sleep };
}

/** The example offer of the OpenAPI spec, with the coordinates in GeoJSON order. */
const SPEC_JOB = {
  identifier: {
    id: OFFER_ID,
    partner_job_id: "b16a546a-e61f-4028-b5a3-1a7bbfaa4e3d",
    partner_label: "offres_emploi_lba",
  },
  workplace: {
    name: "DIRECTION INTERMINISTERIELLE DU NUMERIQUE (DINUM)",
    description: "Service du Premier ministre",
    website: "https://beta.gouv.fr/startups/",
    siret: "13002526500013",
    location: {
      address: "20 AVENUE DE SEGUR 75007 PARIS",
      geopoint: { type: "Point", coordinates: [2.308628, 48.850699] },
    },
    brand: null,
    legal_name: "DIRECTION INTERMINISTERIELLE DU NUMERIQUE",
    size: "100-199",
    domain: {
      idcc: 1979,
      opco: "OPCO 2i",
      naf: { code: "8411Z", label: "Administration publique générale" },
    },
  },
  apply: {
    phone: "0100000000",
    url: "https://labonnealternance.apprentissage.beta.gouv.fr/recherche-apprentissage",
    recipient_id: `partners_${OFFER_ID}`,
  },
  contract: {
    start: "2026-09-23T10:00:00.000Z",
    duration: 12,
    type: ["Apprentissage", "Professionnalisation"],
    remote: "onsite",
  },
  offer: {
    title: " Développeur / Développeuse web ",
    desired_skills: ["Travailler en équipe"],
    to_be_acquired_skills: [],
    access_conditions: [],
    opening_count: 1,
    publication: { creation: "2026-07-23T13:23:01.000Z", expiration: "2027-05-14T00:00:00Z" },
    rome_codes: ["M1805", "invalid"],
    description: "Conçoit et développe des applications.",
    target_diploma: { european: "5", label: "BTS, DEUST (Bac+2)" },
    status: "Active",
  },
  is_delegated: false,
};

/** A company without a published offer, shaped like the `recruiters` items of a real search. */
const SPEC_RECRUITER = {
  identifier: { id: "6a003c399a6be614e48abba9" },
  workplace: {
    ...SPEC_JOB.workplace,
    name: null,
    legal_name: "ATELIER NUMERIQUE SAS",
    brand: "Atelier numérique",
    description: null,
    website: null,
    siret: "12345678901234",
    size: "10-19",
  },
  apply: {
    phone: " 01 23 45 67 89 ",
    url: "https://labonnealternance.apprentissage.beta.gouv.fr/emploi/recruteurs_lba/12345678901234/atelier",
    recipient_id: null,
  },
};

describe("hiring companies", () => {
  it("returns the companies without a published offer next to the offers", async () => {
    const nameless = {
      ...SPEC_RECRUITER,
      identifier: { id: "nameless" },
      workplace: { ...SPEC_RECRUITER.workplace, legal_name: " ", brand: null },
    };
    const { provider } = setup(
      json(200, {
        jobs: [SPEC_JOB],
        recruiters: [SPEC_RECRUITER, { identifier: {} }, nameless],
        warnings: [],
      }),
    );
    const result = await provider.search({ ...PARIS, romeCodes: ["M1805"] });
    expect(result.offers).toHaveLength(1);
    expect(result.hiringCompanies).toEqual([
      {
        externalId: "6a003c399a6be614e48abba9",
        siret: "12345678901234",
        name: "ATELIER NUMERIQUE SAS",
        nafCode: "8411Z",
        nafLabel: "Administration publique générale",
        headcount: "10-19",
        address: "20 AVENUE DE SEGUR 75007 PARIS",
        lat: 48.850699,
        lng: 2.308628,
        applyUrl: SPEC_RECRUITER.apply.url,
        phone: "01 23 45 67 89",
      },
    ]);
  });
});

describe("ApiAlternanceProvider.search", () => {
  it("sends the documented parameters with a bearer token", async () => {
    const { provider, calls } = setup(json(200, { jobs: [], recruiters: [], warnings: [] }));
    await provider.search({
      romeCodes: ["M1805", "M1855", "M1805"],
      ...PARIS,
      diplomaLevel: "bac+4",
    });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    if (!call) throw new Error("Expected one request");
    expect(`${call.url.origin}${call.url.pathname}`).toBe(
      "https://api.apprentissage.beta.gouv.fr/api/job/v1/search",
    );
    expect(Object.fromEntries(call.url.searchParams)).toEqual({
      romes: "M1805,M1855",
      latitude: "48.8566",
      longitude: "2.3522",
      radius: "30",
      target_diploma_level: "6",
    });
    const headers = new Headers(call.init?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(headers.get("user-agent")).toMatch(/^Candidatly\//);
  });

  it("normalises the real offers of the fixture", async () => {
    const { provider } = setup(json(200, fixture("search.json")));
    const result = await provider.search({ romeCodes: ["M1805"], ...PARIS });

    expect(result.skipped).toBe(0);
    expect(result.offers).toHaveLength(3);
    for (const offer of result.offers) {
      expect(offer.externalId).toMatch(/^[^:]+:.+/);
      expect(offer.lat).toBeGreaterThan(41);
      expect(offer.lat).toBeLessThan(52);
      expect(offer.lng).toBeGreaterThan(-6);
      expect(offer.lng).toBeLessThan(10);
      expect(offer.postalCode === null || /^\d{5}$/.test(offer.postalCode)).toBe(true);
    }
    const franceTravail = result.offers.find((o) => o.externalId.startsWith("France Travail:"));
    expect(franceTravail?.applyChannel).toBe("external_url");
    expect(franceTravail?.applyTarget).toMatch(/^https:\/\//);
    const lba = result.offers.find((o) => o.externalId.startsWith("offres_emploi_lba:"));
    expect(lba?.applyChannel).toBe("api_alternance");
    expect(lba?.applyTarget).toMatch(/^partners_[0-9a-f]{24}$/);
  });

  it("skips malformed offers instead of failing the whole search", async () => {
    const { provider } = setup(
      json(200, { jobs: [SPEC_JOB, { identifier: {} }], recruiters: [], warnings: [] }),
    );
    const result = await provider.search({ romeCodes: ["M1805"], ...PARIS });
    expect(result.offers).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("rejects an unexpected envelope", async () => {
    const { provider } = setup(json(200, { jobs: "none" }));
    const error = await provider
      .search({ romeCodes: ["M1805"], ...PARIS })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExternalApiError);
    expect((error as ExternalApiError).issues.map((i) => i.path)).toContain("jobs");
  });

  it("validates parameters before calling the API", async () => {
    const { provider, calls } = setup();
    const error = await provider.search({ romeCodes: ["M18"], ...PARIS }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it("does not retry an invalid key", async () => {
    const { provider, calls } = setup(
      json(401, {
        statusCode: 401,
        name: "Unauthorized",
        message: "Impossible de déchiffrer la clé d'API",
      }),
    );
    const error = await provider
      .search({ romeCodes: ["M1805"], ...PARIS })
      .catch((e: unknown) => e);
    expect((error as ExternalApiError).status).toBe(401);
    expect(calls).toHaveLength(1);
  });

  it("waits for Retry-After on 429 and treats 419 the same way", async () => {
    const { provider, calls, sleep } = setup(
      json(429, { statusCode: 429, error: "Too Many Requests" }, { "retry-after": "3" }),
      json(419, { statusCode: 419 }, { "x-ratelimit-reset": "2" }),
      json(200, { jobs: [SPEC_JOB], recruiters: [], warnings: [] }),
    );
    const result = await provider.search({ romeCodes: ["M1805"], ...PARIS });
    expect(result.offers).toHaveLength(1);
    expect(calls).toHaveLength(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([3000, 2000]);
  });

  it("surfaces a rate limit that outlasts the retries", async () => {
    const { provider } = setup(json(429, {}), json(429, {}), json(429, {}));
    const error = await provider
      .search({ romeCodes: ["M1805"], ...PARIS })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitedError);
  });
});

describe("ApiAlternanceProvider.getOffer", () => {
  it("returns the normalised offer", async () => {
    const { provider, calls } = setup(json(200, fixture("offer.json")));
    const offer = await provider.getOffer(OFFER_ID);
    expect(calls[0]?.url.pathname).toBe(`/api/job/v1/offer/${OFFER_ID}`);
    expect(offer?.source).toBe("api_alternance");
  });

  it("returns null for an unknown offer", async () => {
    const { provider } = setup(
      json(404, {
        statusCode: 404,
        error: "Not Found",
        message: "Aucune offre d'emploi trouvée pour l'ID",
      }),
    );
    await expect(provider.getOffer(OFFER_ID)).resolves.toBeNull();
  });

  it("rejects an identifier that is not an ObjectId", async () => {
    const { provider, calls } = setup();
    await expect(provider.getOffer("../search")).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });
});

describe("normalisation", () => {
  const job = JobOfferReadSchema.parse(SPEC_JOB);
  const offer = normalizeJobOffer(job, SPEC_JOB);

  it("maps every field to our vocabulary", () => {
    expect(offer).toMatchObject({
      externalId: "offres_emploi_lba:b16a546a-e61f-4028-b5a3-1a7bbfaa4e3d",
      providerOfferId: OFFER_ID,
      title: "Développeur / Développeuse web",
      contractTypes: ["apprentissage", "professionnalisation"],
      diplomaLevel: 5,
      companyName: "DIRECTION INTERMINISTERIELLE DU NUMERIQUE (DINUM)",
      companySiret: "13002526500013",
      companyWebsite: "https://beta.gouv.fr/startups/",
      postalCode: "75007",
      lat: 48.850699,
      lng: 2.308628,
      romeCodes: ["M1805"],
      applyChannel: "api_alternance",
      applyTarget: `partners_${OFFER_ID}`,
      publishedAt: "2026-07-23T13:23:01.000Z",
    });
  });

  it("falls back to the application URL without recipient_id", () => {
    const withoutRecipient = normalizeJobOffer(
      JobOfferReadSchema.parse({
        ...SPEC_JOB,
        apply: { phone: null, url: "https://candidat.francetravail.fr/offres/123" },
      }),
      {},
    );
    expect(withoutRecipient.applyChannel).toBe("external_url");
    expect(withoutRecipient.applyTarget).toBe("https://candidat.francetravail.fr/offres/123");
  });

  it("produces an offers row", () => {
    const row = toOfferRow(offer, new Date("2026-09-10T12:00:00Z"));
    expect(row).toMatchObject({
      source: "api_alternance",
      external_id: offer.externalId,
      contract_types: ["apprentissage", "professionnalisation"],
      diploma_level: 5,
      postal_code: "75007",
      apply_channel: "api_alternance",
      last_seen_at: "2026-09-10T12:00:00.000Z",
      removed_at: null,
    });
  });

  it("maps profile levels to European levels", () => {
    expect(toTargetDiplomaLevel("bac")).toBe("4");
    expect(toTargetDiplomaLevel("bac+2")).toBe("5");
    expect(toTargetDiplomaLevel("bac+3")).toBe("6");
    expect(toTargetDiplomaLevel("bac+4")).toBe("6");
    expect(toTargetDiplomaLevel("bac+5")).toBe("7");
    expect(toTargetDiplomaLevel(null)).toBeNull();
  });

  it("extracts the postal code from an address", () => {
    expect(extractPostalCode("20 AVENUE DE SEGUR 75007 PARIS")).toBe("75007");
    expect(extractPostalCode("BP 12345 69002 LYON CEDEX")).toBe("69002");
    expect(extractPostalCode("Lyon")).toBeNull();
  });
});
