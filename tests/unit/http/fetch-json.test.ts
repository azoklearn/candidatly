import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ExternalApiError, RateLimitedError } from "@/lib/errors";
import { fetchJson, parseRetryAfter, type FetchLike } from "@/lib/http/fetch-json";
import { createLogger } from "@/lib/logger";

const silent = createLogger({}, { write: () => {} });
const url = new URL("https://api.example.org/items");
const Schema = z.object({ ok: z.boolean() });

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function queue(...responses: Response[]) {
  const calls: RequestInit[] = [];
  const impl: FetchLike = async (_input, init) => {
    calls.push(init ?? {});
    const next = responses.shift();
    if (!next) throw new Error("Unexpected extra request");
    return next;
  };
  return { impl, calls };
}

const baseOptions = { source: "test", url, schema: Schema, timeoutMs: 1_000, logger: silent };

describe("fetchJson", () => {
  it("returns validated data", async () => {
    const { impl } = queue(json(200, { ok: true, extra: 1 }));
    const result = await fetchJson({ ...baseOptions, fetchImpl: impl });
    expect(result.data).toEqual({ ok: true });
    expect(result.status).toBe(200);
  });

  it("rejects an unexpected payload with the Zod path", async () => {
    const { impl } = queue(json(200, { ok: "yes" }));
    const error = await fetchJson({ ...baseOptions, fetchImpl: impl }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExternalApiError);
    expect((error as ExternalApiError).issues[0]?.path).toBe("ok");
    expect((error as ExternalApiError).retryable).toBe(false);
  });

  it("retries a 503 with exponential backoff, then succeeds", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const { impl, calls } = queue(json(503, {}), json(503, {}), json(200, { ok: true }));
    const result = await fetchJson({ ...baseOptions, fetchImpl: impl, sleep });
    expect(result.data.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1000]);
  });

  it("honours Retry-After on 429 and gives up after the retry budget", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const { impl, calls } = queue(
      json(429, { statusCode: 429, error: "Too Many Requests" }, { "retry-after": "3" }),
      json(429, {}, { "retry-after": "3" }),
      json(429, {}, { "retry-after": "3" }),
    );
    const error = await fetchJson({ ...baseOptions, fetchImpl: impl, sleep }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RateLimitedError);
    expect((error as RateLimitedError).retryAfterSeconds).toBe(3);
    expect(calls).toHaveLength(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([3000, 3000]);
  });

  it("never retries a POST", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const { impl, calls } = queue(json(503, {}));
    const error = await fetchJson({
      ...baseOptions,
      method: "POST",
      body: { a: 1 },
      fetchImpl: impl,
      sleep,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExternalApiError);
    expect(calls).toHaveLength(1);
    expect(new Headers(calls[0]?.headers).get("content-type")).toBe("application/json");
    expect(sleep).not.toHaveBeenCalled();
  });

  it("does not retry a 401", async () => {
    const { impl, calls } = queue(json(401, { statusCode: 401, name: "Unauthorized" }));
    const error = await fetchJson({ ...baseOptions, fetchImpl: impl }).catch((e: unknown) => e);
    expect((error as ExternalApiError).status).toBe(401);
    expect((error as ExternalApiError).retryable).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("turns a timeout into a retryable error", async () => {
    const hanging: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const error = await fetchJson({
      ...baseOptions,
      timeoutMs: 20,
      fetchImpl: hanging,
      retry: { maxRetries: 0 },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExternalApiError);
    expect((error as ExternalApiError).message).toContain("Timeout");
    expect((error as ExternalApiError).retryable).toBe(true);
  });

  it("does not retry when the caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    const failing: FetchLike = async (_input, init) => {
      throw init?.signal?.reason ?? new Error("aborted");
    };
    const error = await fetchJson({
      ...baseOptions,
      signal: controller.signal,
      fetchImpl: failing,
    }).catch((e: unknown) => e);
    expect((error as ExternalApiError).retryable).toBe(false);
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds, HTTP dates and x-ratelimit-reset", () => {
    expect(parseRetryAfter(new Headers({ "retry-after": "5" }))).toBe(5);
    const now = new Date("2026-09-10T12:00:00Z");
    expect(
      parseRetryAfter(new Headers({ "retry-after": "Thu, 10 Sep 2026 12:00:30 GMT" }), now),
    ).toBe(30);
    expect(parseRetryAfter(new Headers({ "x-ratelimit-reset": "60" }))).toBe(60);
    expect(parseRetryAfter(new Headers())).toBeNull();
  });
});
