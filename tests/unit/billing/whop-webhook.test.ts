import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { WhopEventSchema, verifyWhopSignature } from "@/lib/billing/whop-webhook";

const SECRET = "ws_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const NOW = new Date("2026-09-11T17:00:00Z");
const TS = String(NOW.getTime() / 1000);
const BODY = JSON.stringify({
  id: "msg_1",
  type: "membership.activated",
  data: { id: "mem_abc123" },
});

const sign = (key: Buffer | string, id = "msg_1", ts = TS, body = BODY) =>
  `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;

const headers = (signature: string, ts = TS) => ({ id: "msg_1", timestamp: ts, signature });

describe("verifyWhopSignature", () => {
  it("accepts a delivery signed with the secret", () => {
    expect(
      verifyWhopSignature({ body: BODY, secret: SECRET, now: NOW, headers: headers(sign(SECRET)) }),
    ).toBe(true);
  });

  it("also accepts the Standard Webhooks key derivation", () => {
    const decoded = Buffer.from(SECRET.slice(3), "base64");
    expect(
      verifyWhopSignature({
        body: BODY,
        secret: SECRET,
        now: NOW,
        headers: headers(sign(decoded)),
      }),
    ).toBe(true);
  });

  it("finds the valid signature among several", () => {
    const signature = `v1,AAAA ${sign(SECRET)}`;
    expect(
      verifyWhopSignature({ body: BODY, secret: SECRET, now: NOW, headers: headers(signature) }),
    ).toBe(true);
  });

  it("rejects a changed body, another secret, an old delivery and missing headers", () => {
    const good = sign(SECRET);
    expect(
      verifyWhopSignature({ body: `${BODY} `, secret: SECRET, now: NOW, headers: headers(good) }),
    ).toBe(false);
    expect(
      verifyWhopSignature({
        body: BODY,
        secret: SECRET,
        now: NOW,
        headers: headers(sign("ws_another_secret_value_0000000000")),
      }),
    ).toBe(false);
    const old = String(NOW.getTime() / 1000 - 600);
    expect(
      verifyWhopSignature({
        body: BODY,
        secret: SECRET,
        now: NOW,
        headers: headers(sign(SECRET, "msg_1", old), old),
      }),
    ).toBe(false);
    expect(
      verifyWhopSignature({
        body: BODY,
        secret: SECRET,
        now: NOW,
        headers: { id: null, timestamp: TS, signature: good },
      }),
    ).toBe(false);
  });
});

describe("WhopEventSchema", () => {
  it("reads the envelope of a v1 event", () => {
    expect(WhopEventSchema.parse(JSON.parse(BODY))).toMatchObject({
      type: "membership.activated",
      data: { id: "mem_abc123" },
    });
    expect(WhopEventSchema.safeParse({ id: "x", type: "y" }).success).toBe(false);
  });
});
