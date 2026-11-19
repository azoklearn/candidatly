import { describe, expect, it } from "vitest";

import {
  NIGHT_MAX_PENDING,
  NIGHT_MAX_PER_USER,
  NIGHT_MIN_SCORE,
  planNightPrep,
  type NightMatch,
} from "@/lib/applications/night-prep";

const match = (offerId: string, score: number, patch: Partial<NightMatch> = {}): NightMatch => ({
  offerId,
  score,
  status: "new",
  noiseKind: null,
  ...patch,
});
const plan = (matches: NightMatch[], options: { applied?: string[]; pending?: number } = {}) =>
  planNightPrep({
    matches,
    appliedOfferIds: new Set(options.applied ?? []),
    pendingNightDrafts: options.pending ?? 0,
  });

describe("night preparation (C123)", () => {
  it("takes the best offers of the night, a few at most", () => {
    const chosen = plan([match("a", 70), match("b", 95), match("c", 82), match("d", 88)]);
    expect(chosen).toEqual(["b", "d", "c"]);
    expect(chosen).toHaveLength(NIGHT_MAX_PER_USER);
  });

  it("writes no letter nobody would send", () => {
    expect(
      plan(
        [
          match("low", NIGHT_MIN_SCORE - 1),
          match("school", 90, { noiseKind: "school" }),
          match("agency", 90, { noiseKind: "staffing" }),
          match("dismissed", 90, { status: "dismissed" }),
          match("applied", 90, { status: "applied" }),
          match("done", 90),
          match("ok", NIGHT_MIN_SCORE),
        ],
        { applied: ["done"] },
      ),
    ).toEqual(["ok"]);
  });

  it("keeps an offer the student saved", () => {
    expect(plan([match("saved", 80, { status: "saved" })])).toEqual(["saved"]);
  });

  it("stops adding letters when unread ones pile up", () => {
    const matches = [match("a", 90), match("b", 85), match("c", 80)];
    expect(plan(matches, { pending: NIGHT_MAX_PENDING - 1 })).toEqual(["a"]);
    expect(plan(matches, { pending: NIGHT_MAX_PENDING })).toEqual([]);
    expect(plan(matches, { pending: NIGHT_MAX_PENDING + 3 })).toEqual([]);
  });
});
