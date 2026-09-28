import "server-only";

import { cookies } from "next/headers";

import {
  DRAFT_COOKIE,
  DRAFT_MAX_AGE_SECONDS,
  mergeDraft,
  parseDraft,
  serializeDraft,
  type OnboardingDraft,
} from "./draft";

/** The questionnaire draft of a visitor, kept in an http-only cookie (docs/QUESTIONS.md C91). */

export async function readDraft(): Promise<OnboardingDraft> {
  return parseDraft((await cookies()).get(DRAFT_COOKIE)?.value);
}

export async function saveDraft(patch: OnboardingDraft): Promise<OnboardingDraft> {
  const store = await cookies();
  const draft = mergeDraft(parseDraft(store.get(DRAFT_COOKIE)?.value), patch);
  store.set(DRAFT_COOKIE, serializeDraft(draft), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DRAFT_MAX_AGE_SECONDS,
  });
  return draft;
}

export async function clearDraft(): Promise<void> {
  (await cookies()).delete(DRAFT_COOKIE);
}
