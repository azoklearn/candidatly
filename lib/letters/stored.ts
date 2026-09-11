import { z } from "zod";

import { CoverLetterChangeSchema } from "./adapt";

/** What applications.cover_letter_diff holds: the adaptation and the base letter it started from. */
export const StoredLetterDiffSchema = z.object({
  generator: z.string(),
  base_letter: z.string(),
  generated_letter: z.string(),
  changes: z.array(CoverLetterChangeSchema),
  confidence: z.number().min(0).max(1),
  missing_info: z.array(z.string()),
});
export type StoredLetterDiff = z.infer<typeof StoredLetterDiffSchema>;
