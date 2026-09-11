import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

/**
 * Whop webhooks follow Standard Webhooks (docs.whop.com, "Webhooks"): the headers
 * webhook-id, webhook-timestamp (seconds) and webhook-signature ("v1,<base64>") sign the
 * string "{id}.{timestamp}.{raw body}" with HMAC-SHA256.
 */

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export type WebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

/**
 * Whop documents the ws_ secret itself as the key; Standard Webhooks libraries decode the
 * part after the prefix. Both derive from the same secret, so both are accepted.
 */
function candidateKeys(secret: string): Buffer[] {
  const keys = [Buffer.from(secret, "utf8")];
  const encoded = secret.replace(/^(ws|whsec)_/, "");
  if (encoded !== secret && /^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    keys.push(Buffer.from(encoded, "base64"));
  }
  return keys;
}

export function verifyWhopSignature(input: {
  body: string;
  headers: WebhookHeaders;
  secret: string;
  now?: Date;
}): boolean {
  const { id, timestamp, signature } = input.headers;
  if (!id || !timestamp || !signature || !input.secret) return false;
  const seconds = Number(timestamp);
  const nowSeconds = (input.now ?? new Date()).getTime() / 1000;
  if (!Number.isInteger(seconds) || Math.abs(nowSeconds - seconds) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }
  const signed = `${id}.${timestamp}.${input.body}`;
  const expected = candidateKeys(input.secret).map((key) =>
    createHmac("sha256", key).update(signed).digest(),
  );
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",", 2);
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return expected.some(
      (digest) => digest.length === given.length && timingSafeEqual(digest, given),
    );
  });
}

/** Envelope of a v1 event: only the fields the handler relies on. */
export const WhopEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.looseObject({ id: z.string().min(1) }),
});
export type WhopEvent = z.infer<typeof WhopEventSchema>;
