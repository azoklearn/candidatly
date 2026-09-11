import { track } from "@vercel/analytics/server";
import { headers } from "next/headers";

import type { EventName, EventProperties } from "@/lib/analytics";
import { isVercelAnalyticsAvailable } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Custom event sent from a server action or a route handler (docs/QUESTIONS.md C85). Only on
 * Vercel deployments; a failure is logged and never breaks the caller.
 */
export async function trackServerEvent(
  name: EventName,
  properties?: EventProperties,
  request?: Request,
): Promise<void> {
  if (!isVercelAnalyticsAvailable()) return;
  try {
    await track(name, properties, request ? { request } : { headers: await headers() });
  } catch (error) {
    logger.warn("analytics_event_failed", { name, error });
  }
}
