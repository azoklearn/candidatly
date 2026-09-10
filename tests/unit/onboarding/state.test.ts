import { describe, expect, it } from "vitest";

import {
  completedSteps,
  firstIncompleteStep,
  isStepAccessible,
  parseStep,
  type OnboardingSnapshot,
} from "@/lib/onboarding/state";

const empty: OnboardingSnapshot = {
  profile: {
    first_name: null,
    last_name: null,
    school: null,
    degree_label: null,
    diploma_level: null,
    rome_codes: [],
    location_lat: null,
    location_lng: null,
    onboarding_completed: false,
  },
  hasCv: false,
  hasLetter: false,
};

const withProfile: OnboardingSnapshot = {
  ...empty,
  profile: {
    ...empty.profile,
    first_name: "Camille",
    last_name: "Martin",
    school: "IUT de Lyon",
    degree_label: "BUT Informatique",
    diploma_level: "bac+3",
  },
};

describe("onboarding progress", () => {
  it("starts at the profile step right after sign-up", () => {
    expect([...completedSteps(empty)]).toEqual([1]);
    expect(firstIncompleteStep(empty)).toBe(2);
  });

  it("moves forward as each step is filled in", () => {
    expect(firstIncompleteStep(withProfile)).toBe(3);
    const withRome = { ...withProfile, profile: { ...withProfile.profile, rome_codes: ["M1805"] } };
    expect(firstIncompleteStep(withRome)).toBe(4);
    const located = {
      ...withRome,
      profile: { ...withRome.profile, location_lat: 45.76, location_lng: 4.84 },
    };
    expect(firstIncompleteStep(located)).toBe(5);
    expect(firstIncompleteStep({ ...located, hasCv: true })).toBe(5);
    expect(firstIncompleteStep({ ...located, hasCv: true, hasLetter: true })).toBe(6);
  });

  it("requires every profile field, blank strings included", () => {
    expect(
      firstIncompleteStep({ ...withProfile, profile: { ...withProfile.profile, school: "  " } }),
    ).toBe(2);
  });

  it("lets users revisit earlier steps but not skip ahead", () => {
    expect(isStepAccessible(1, withProfile)).toBe(true);
    expect(isStepAccessible(3, withProfile)).toBe(true);
    expect(isStepAccessible(4, withProfile)).toBe(false);
    expect(isStepAccessible(0, withProfile)).toBe(false);
  });

  it("parses step numbers from the URL", () => {
    expect(parseStep("3")).toBe(3);
    expect(parseStep("7")).toBeNull();
    expect(parseStep("abc")).toBeNull();
    expect(parseStep("2.5")).toBeNull();
  });
});
