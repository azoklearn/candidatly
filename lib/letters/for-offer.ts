import { cityFromAddress } from "@/lib/format";
import { JobOfferReadSchema } from "@/lib/providers/api-alternance";
import type { Tables } from "@/lib/supabase/database.types";
import { toPlainText } from "@/lib/text/html";

import { LETTER_GENERATOR, adaptLetter } from "./adapt";
import type { StoredLetterDiff } from "./stored";

/**
 * The student's base letter adapted to one offer, by rules (docs/QUESTIONS.md B11). Shared
 * by the "prepare my application" button and by the night preparation (C123). The company
 * name comes from the offer; `registryName` is the register's spelling, used when the
 * offer gives none.
 */
export function letterForOffer(input: {
  baseLetter: string;
  cvText: string;
  offer: Pick<
    Tables<"offers">,
    "title" | "company_name" | "is_delegated" | "location_label" | "description" | "raw"
  >;
  registryName?: string | null;
}): StoredLetterDiff {
  const { offer } = input;
  const job = JobOfferReadSchema.safeParse(offer.raw);
  const result = adaptLetter({
    baseLetter: input.baseLetter,
    cvText: input.cvText,
    offer: {
      title: offer.title,
      // The recruiter's spelling reads better than the registry's capitals; delegated offers
      // name the school, not the employer.
      companyName: offer.is_delegated ? null : (offer.company_name ?? input.registryName ?? null),
      city: cityFromAddress(offer.location_label),
      skills: job.success ? job.data.offer.desired_skills : [],
      description: toPlainText(offer.description),
    },
  });
  return {
    generator: LETTER_GENERATOR,
    base_letter: input.baseLetter,
    generated_letter: result.letter,
    changes: result.changes,
    confidence: result.confidence,
    missing_info: result.missing_info,
  };
}
