import { DatabaseError } from "@/lib/errors";
import { logger as defaultLogger, type Logger } from "@/lib/logger";
import type { Db } from "@/lib/offers/sync";

import { enrichCompany } from "./enrich-company";

/** Identifies a few employers of fresh offers ahead of time, within the scheduled sync's budget. */
export async function enrichPendingCompanies(options: {
  db: Db;
  now: Date;
  limit: number;
  deadline: number;
  clock?: () => number;
  logger?: Logger;
}): Promise<number> {
  const { db, now } = options;
  const clock = options.clock ?? Date.now;
  const log = (options.logger ?? defaultLogger).child({ task: "pending_companies" });
  if (clock() >= options.deadline) return 0;
  const pending = await db.rpc("pending_company_sirets", { p_limit: options.limit });
  if (pending.error) throw new DatabaseError("pending_company_sirets", pending.error);
  let done = 0;
  for (const row of pending.data) {
    if (clock() >= options.deadline) break;
    try {
      await enrichCompany(
        {
          siret: row.siret,
          name: row.company_name,
          postalCode: row.postal_code,
          website: row.company_website,
          description: row.company_description,
        },
        { db, now, logger: log },
      );
      done++;
    } catch (error) {
      log.warn("pending_company_failed", { error });
    }
  }
  return done;
}
