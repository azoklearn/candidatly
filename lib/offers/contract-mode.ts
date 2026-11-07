import type { Database } from "@/lib/supabase/database.types";

export type TargetContract = Database["public"]["Enums"]["profiles_target_contract"];

/**
 * Internships and student jobs have no published offers in the source we query, which only
 * carries work-study contracts. Rather than "coming soon", a student looking for one gets the
 * companies of their trades around them, to contact directly (owner, 7 November 2026, C106).
 * "Peu importe" keeps the work-study offers, with the companies alongside.
 */
export function companiesOnly(contract: string | null | undefined): boolean {
  return contract === "stage" || contract === "job_etudiant";
}
