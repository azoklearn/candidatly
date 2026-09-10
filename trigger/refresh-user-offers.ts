import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

import { refreshOffersForUser } from "@/lib/offers/refresh";
import { createApiAlternanceProvider } from "@/lib/providers/api-alternance";
import { createAdminClient } from "@/lib/supabase/admin";

/** Right after onboarding: fetch the offers of this user's search, then compute matches. */
export const refreshUserOffers = schemaTask({
  id: "refresh-user-offers",
  schema: z.object({ userId: z.uuid() }),
  maxDuration: 180,
  run: async ({ userId }) =>
    refreshOffersForUser({
      db: createAdminClient(),
      provider: createApiAlternanceProvider(),
      userId,
      now: new Date(),
    }),
});
