import { describe, expect, it } from "vitest";

import {
  draftProfileUpdate,
  draftProfileValues,
  draftSnapshot,
  isDraftEmpty,
  mergeDraft,
  parseDraft,
  serializeDraft,
  type OnboardingDraft,
} from "@/lib/onboarding/draft";
import { firstIncompleteStep, VISITOR_LAST_STEP } from "@/lib/onboarding/state";

const answered: OnboardingDraft = {
  target_contract: "alternance",
  contract_chosen_at: "2026-09-28T09:00:00Z",
  domain_free_text: "Informatique et numérique",
  rome_codes: ["M1805"],
  diploma_level: "bac+3",
  location_label: "Lyon",
  location_lat: 45.76,
  location_lng: 4.84,
  insee_code: "69123",
  search_radius_km: 30,
};

describe("questionnaire draft", () => {
  it("reads back what it wrote", () => {
    expect(parseDraft(serializeDraft(answered))).toEqual(answered);
  });

  it("treats a missing, broken or tampered cookie as no answer at all", () => {
    expect(parseDraft(undefined)).toEqual({});
    expect(parseDraft("not json")).toEqual({});
    expect(parseDraft(JSON.stringify({ rome_codes: ["nope"] }))).toEqual({});
    expect(parseDraft(JSON.stringify({ billing_exempt: true }))).toEqual({});
    expect(isDraftEmpty(parseDraft(null))).toBe(true);
  });

  it("keeps only the fields of the questionnaire", () => {
    const parsed = parseDraft(
      JSON.stringify({ first_name: "Camille", onboarding_completed: true, user_id: "abc" }),
    );
    expect(parsed).toEqual({ first_name: "Camille" });
  });

  it("merges each step over the previous answers", () => {
    const merged = mergeDraft({ first_name: "Camille" }, { first_name: "Alex", school: "IUT" });
    expect(merged).toEqual({ first_name: "Alex", school: "IUT" });
  });

  it("follows the same progress rules as a profile", () => {
    expect(firstIncompleteStep(draftSnapshot({}))).toBe(1);
    expect(firstIncompleteStep(draftSnapshot({ ...answered, rome_codes: [] }))).toBe(3);
    // Everything a visitor can answer is answered: the account comes next.
    expect(firstIncompleteStep(draftSnapshot(answered))).toBe(VISITOR_LAST_STEP + 1);
  });

  it("writes only the answers that were given onto the profile", () => {
    expect(draftProfileUpdate({ first_name: "Camille", phone: null })).toEqual({
      first_name: "Camille",
      phone: null,
    });
    expect(draftProfileUpdate({})).toEqual({});
  });

  it("fills the profile screens, with alternance as the default contract", () => {
    expect(draftProfileValues({})).toMatchObject({
      first_name: null,
      target_contract: "alternance",
    });
    expect(draftProfileValues({ target_contract: "stage" }).target_contract).toBe("stage");
  });
});
