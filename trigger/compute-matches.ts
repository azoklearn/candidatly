import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

import { computeMatchesForUser } from "@/lib/matching/compute";
import { createAdminClient } from "@/lib/supabase/admin";

/** compute-matches (brief section 6): scores the live offers around one user. */
export const computeMatches = schemaTask({
  id: "compute-matches",
  schema: z.object({ userId: z.uuid() }),
  maxDuration: 120,
  run: async ({ userId }) =>
    computeMatchesForUser({ db: createAdminClient(), userId, now: new Date() }),
});
