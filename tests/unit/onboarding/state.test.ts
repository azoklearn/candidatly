import { describe, expect, it } from "vitest";

import {
  ACCOUNT_STEP,
  ANALYSIS_PATH,
  completedSteps,
  FINISH_PATH,
  firstIncompleteStep,
  isQuestionnaireDone,
  isStepAccessible,
  LAST_STEP,
  nextAfterScan,
  nextOnboardingPath,
  parseStep,
  RECAP_PATH,
  VISITOR_LAST_STEP,
  type OnboardingSnapshot,
} from "@/lib/onboarding/state";

const empty: OnboardingSnapshot = {
  profile: {
    first_name: null,
    last_name: null,
    contract_chosen_at: null,
    domain_free_text: null,
    rome_codes: [],
    diploma_level: null,
    location_lat: null,
    location_lng: null,
    onboarding_completed: false,
  },
  hasCv: false,
  hasLetter: false,
};

const answered: OnboardingSnapshot = {
  ...empty,
  profile: {
    ...empty.profile,
    contract_chosen_at: "2026-09-28T09:00:00Z",
    domain_free_text: "Informatique et numérique",
    rome_codes: ["M1805"],
    diploma_level: "bac+3",
    location_lat: 45.76,
    location_lng: 4.84,
  },
};

describe("onboarding progress", () => {
  it("starts at the first question", () => {
    expect([...completedSteps(empty)]).toEqual([]);
    expect(firstIncompleteStep(empty)).toBe(1);
  });

  it("moves forward one question at a time", () => {
    const contract = {
      ...empty,
      profile: { ...empty.profile, contract_chosen_at: "2026-09-28T09:00:00Z" },
    };
    expect(firstIncompleteStep(contract)).toBe(2);
    const domain = {
      ...contract,
      profile: { ...contract.profile, domain_free_text: "Informatique et numérique" },
    };
    expect(firstIncompleteStep(domain)).toBe(3);
    const jobs = { ...domain, profile: { ...domain.profile, rome_codes: ["M1805"] } };
    expect(firstIncompleteStep(jobs)).toBe(4);
    const level = { ...jobs, profile: { ...jobs.profile, diploma_level: "bac+3" as const } };
    expect(firstIncompleteStep(level)).toBe(5);
    const located = {
      ...level,
      profile: { ...level.profile, location_lat: 45.76, location_lng: 4.84 },
    };
    // Everything a visitor can answer: the account comes next.
    expect(firstIncompleteStep(located)).toBe(ACCOUNT_STEP);
  });

  it("ends with the account: no CV, no letter (C111)", () => {
    expect(isQuestionnaireDone(answered)).toBe(false);
    expect(nextOnboardingPath(answered)).toBe(`/onboarding/${ACCOUNT_STEP}`);
    const named = {
      ...answered,
      profile: { ...answered.profile, first_name: "Camille", last_name: "Martin" },
    };
    expect(LAST_STEP).toBe(ACCOUNT_STEP);
    expect(isQuestionnaireDone(named)).toBe(true);
    // The CV is dropped on the landing page, not asked at the end.
    expect(nextOnboardingPath(named)).toBe(FINISH_PATH);
    expect(nextOnboardingPath({ ...named, hasCv: true })).toBe(FINISH_PATH);
  });

  it("ignores blank answers", () => {
    expect(
      firstIncompleteStep({
        ...answered,
        profile: { ...answered.profile, domain_free_text: "  " },
      }),
    ).toBe(2);
  });

  it("lets users revisit earlier steps but not skip ahead", () => {
    expect(isStepAccessible(1, answered)).toBe(true);
    expect(isStepAccessible(5, answered)).toBe(true);
    expect(isStepAccessible(ACCOUNT_STEP, answered)).toBe(true);
    expect(isStepAccessible(0, answered)).toBe(false);
  });

  it("sends a read CV to the confirmation screen, and the others to their question", () => {
    // A field was recognised: one screen instead of five questions (C100).
    expect(nextAfterScan({ hasDomain: true, step: 1 })).toBe(RECAP_PATH);
    expect(nextAfterScan({ hasDomain: true, step: VISITOR_LAST_STEP + 1 })).toBe(RECAP_PATH);
    // Nothing recognised: the questionnaire runs as usual.
    expect(nextAfterScan({ hasDomain: false, step: 2 })).toBe("/onboarding/2");
    expect(nextAfterScan({ hasDomain: false, step: VISITOR_LAST_STEP + 1 })).toBe(ANALYSIS_PATH);
  });

  it("parses step numbers from the URL", () => {
    expect(parseStep("3")).toBe(3);
    expect(parseStep(String(LAST_STEP + 1))).toBeNull();
    expect(parseStep("abc")).toBeNull();
    expect(parseStep("2.5")).toBeNull();
  });
});
