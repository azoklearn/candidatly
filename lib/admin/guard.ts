import "server-only";

import { notFound } from "next/navigation";

import { getAdminEmails } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

import { isAdminEmail } from "./emails";

/**
 * Every /admin page starts here: anyone outside ADMIN_EMAILS gets the usual 404, so the
 * page does not even admit it exists (docs/QUESTIONS.md C90).
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = typeof claims?.claims.email === "string" ? claims.claims.email : null;
  if (!email || !isAdminEmail(email, getAdminEmails())) notFound();
  return email;
}
