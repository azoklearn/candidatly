import { z } from "zod";

/** Lenient reader for matches.score_reasons, written by lib/matching/score.ts. */
export const ScoreReasonsSchema = z.object({
  rome: z.enum(["exact", "related", "none"]).catch("none"),
  distanceKm: z.number().catch(0),
  diploma: z.enum(["exact", "unspecified", "adjacent", "mismatch"]).catch("unspecified"),
  freshnessDays: z.number().nullable().catch(null),
  keywords: z.array(z.string()).catch([]),
});
export type StoredScoreReasons = z.infer<typeof ScoreReasonsSchema>;

export function readScoreReasons(value: unknown): StoredScoreReasons | null {
  const parsed = ScoreReasonsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
