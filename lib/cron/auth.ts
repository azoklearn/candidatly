import { createHash, timingSafeEqual } from "node:crypto";

/** Checks the "Authorization: Bearer <CRON_SECRET>" header of a scheduled call, in constant time. */
export function isAuthorizedCronRequest(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const token = /^Bearer (.+)$/.exec(header)?.[1];
  if (!token) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(token), digest(secret));
}
