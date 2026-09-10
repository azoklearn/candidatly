import { NotImplementedError } from "@/lib/errors";

import type { NormalizedOffer, OfferProvider, OfferSearchResult } from "./types";

/** Internship offers from Adzuna: planned for V2 (brief section 3.4), not implemented in the MVP. */
export class AdzunaProvider implements OfferProvider {
  readonly source = "adzuna" as const;

  async search(): Promise<OfferSearchResult> {
    throw new NotImplementedError("Adzuna provider is planned for V2 (internships)");
  }

  async getOffer(): Promise<NormalizedOffer | null> {
    throw new NotImplementedError("Adzuna provider is planned for V2 (internships)");
  }
}
