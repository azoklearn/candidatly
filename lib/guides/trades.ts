import "server-only";

import { logger } from "@/lib/logger";
import type { JobDomain } from "@/lib/onboarding/domains";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The official labels of the trades of a domain, for the public pages by trade (C122).
 * Read with the service key, like the questionnaire of a visitor; an unreachable database
 * gives an empty list rather than a broken page.
 */
export async function tradeLabels(domain: JobDomain): Promise<string[]> {
  try {
    const { data, error } = await createAdminClient()
      .from("rome_codes")
      .select("code, label")
      .in("code", [...domain.codes])
      .eq("is_active", true);
    if (error) throw error;
    const labels = new Map((data ?? []).map((row) => [row.code, row.label]));
    return domain.codes.flatMap((code) => labels.get(code) ?? []);
  } catch (error) {
    logger.warn("trade_labels_unavailable", { area: "guides", error });
    return [];
  }
}
