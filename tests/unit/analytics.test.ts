import { describe, expect, it } from "vitest";

import { anonymizeUrl } from "@/lib/analytics";

describe("anonymizeUrl", () => {
  it("drops query strings and fragments, sign-in tokens included", () => {
    expect(
      anonymizeUrl("https://gptjob.io/auth/confirm?type=email&token_hash=abc123#top"),
    ).toBe("https://gptjob.io/auth/confirm");
    expect(anonymizeUrl("https://gptjob.io/offers?company=Acme&km=20")).toBe(
      "https://gptjob.io/offers",
    );
  });

  it("replaces identifiers in the path", () => {
    expect(
      anonymizeUrl("https://gptjob.io/applications/3f2b8c1e-9d4a-4b7e-8c21-5a6f7e8d9c0b"),
    ).toBe("https://gptjob.io/applications/[id]");
    expect(anonymizeUrl("https://gptjob.io/tarifs")).toBe(
      "https://gptjob.io/tarifs",
    );
  });

  it("keeps the path of a relative address", () => {
    expect(anonymizeUrl("/forfait?paiement=indisponible")).toBe("/forfait");
  });
});
