import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

export const STATE_FILE = "tests/e2e/.state.json";
export const OFFER_TITLE = "Développeur web en alternance (test E2E)";

type TestUser = { id: string; email: string; login: string };
export type E2EState = { offerId: string; users: { student: TestUser; leaver: TestUser } };

/** Service-role client for seeding and cleaning the linked Supabase project. */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function loadState(): E2EState {
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as E2EState;
}
