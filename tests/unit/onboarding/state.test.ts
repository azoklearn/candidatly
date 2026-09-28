import { describe, expect, it } from "vitest";

import {
  ACCOUNT_STEP,
  completedSteps,
  firstIncompleteStep,
  isStepAccessible,
  LAST_STEP,
  parseStep,
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
    documents_skipped_at: null,
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

  it("asks the name once, then the documents", () => {
    const named = {
      ...answered,
      profile: { ...answered.profile, first_name: "Camille", last_name: "Martin" },
    };
    expect(firstIncompleteStep(named)).toBe(ACCOUNT_STEP + 1);
    expect(firstIncompleteStep({ ...named, hasCv: true })).toBe(ACCOUNT_STEP + 1);
    expect(firstIncompleteStep({ ...named, hasCv: true, hasLetter: true })).toBe(LAST_STEP);
  });

  it("lets students skip the CV and the letter (C89)", () => {
    const named = {
      ...answered,
      profile: {
        ...answered.profile,
        first_name: "Camille",
        last_name: "Martin",
        documents_skipped_at: "2026-09-13T09:00:00Z",
      },
    };
    expect(firstIncompleteStep(named)).toBe(LAST_STEP);
    expect(isStepAccessible(LAST_STEP, named)).toBe(true);
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
    expect(isStepAccessible(ACCOUNT_STEP + 1, answered)).toBe(false);
    expect(isStepAccessible(0, answered)).toBe(false);
  });

  it("parses step numbers from the URL", () => {
    expect(parseStep("3")).toBe(3);
    expect(parseStep(String(LAST_STEP + 1))).toBeNull();
    expect(parseStep("abc")).toBeNull();
    expect(parseStep("2.5")).toBeNull();
  });
});
