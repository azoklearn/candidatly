"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

import { anonymizeUrl } from "@/lib/analytics";

function anonymize(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: anonymizeUrl(event.url) };
}

/** Cookieless audience measurement, active once enabled in the Vercel project (C84). */
export function VercelAnalytics() {
  return <Analytics beforeSend={anonymize} />;
}
