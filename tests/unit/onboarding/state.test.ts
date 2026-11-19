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
  nextQuestionPath,
  parseStep,
  RECAP_PATH,
  SEARCH_LAST_STEP,
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
    situation: null,
    start_timing: null,
    weekly_applications: null,
    main_blocker: null,
    onboarding_completed: false,
  },
  hasCv: false,
  hasLetter: false,
};

/** What the search needs: the five first questions, or one CV. */
const searchable: OnboardingSnapshot = {
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

/** Everything a visitor answers before the account: the search and the plan (C118). */
const answered: OnboardingSnapshot = {
  ...searchable,
  profile: {
    ...searchable.profile,
    situation: "has_school",
    start_timing: "2027-09",
    weekly_applications: "low",
    main_blocker: "answers",
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
    // The search is ready; the four questions of the plan follow, one at a time (C118).
    expect(firstIncompleteStep(located)).toBe(SEARCH_LAST_STEP + 1);
    expect(nextQuestionPath(located)).toBe("/onboarding/6");
    const situated = { ...located, profile: { ...located.profile, situation: "exploring" } };
    expect(nextQuestionPath(situated)).toBe("/onboarding/7");
    const dated = { ...situated, profile: { ...situated.profile, start_timing: "asap" } };
    expect(nextQuestionPath(dated)).toBe("/onboarding/8");
    const paced = { ...dated, profile: { ...dated.profile, weekly_applications: "high" } };
    expect(nextQuestionPath(paced)).toBe("/onboarding/9");
    // Everything a visitor can answer: the analysis runs, then the account comes.
    expect(firstIncompleteStep(answered)).toBe(ACCOUNT_STEP);
    expect(nextQuestionPath(answered)).toBe(ANALYSIS_PATH);
  });

  it("sends a CV read on the landing page to the questions of the plan", () => {
    // The CV answered the five first questions at once.
    expect(nextQuestionPath(searchable)).toBe("/onboarding/6");
    expect(VISITOR_LAST_STEP).toBe(9);
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
    expect(isStepAccessible(9, answered)).toBe(true);
    expect(isStepAccessible(7, searchable)).toBe(false);
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
