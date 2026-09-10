import type { z } from "zod";

import { ExternalApiError, RateLimitedError, toValidationIssues } from "@/lib/errors";
import { logger as defaultLogger, type Logger } from "@/lib/logger";

export type FetchLike = (input: URL | string, init?: RequestInit) => Promise<Response>;

export type RetryPolicy = {
  /** Retries after the first attempt. */
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export type FetchJsonOptions<T> = {
  /** Short name of the external service, used in errors and logs. */
  source: string;
  url: URL;
  schema: z.ZodType<T>;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  /** Serialised as JSON. */
  body?: unknown;
  timeoutMs: number;
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
  /** Defaults to 2 retries for GET and none for POST, since a POST may already have been processed. */
  retry?: Partial<RetryPolicy>;
  sleep?: (ms: number) => Promise<void>;
  logger?: Logger;
};

export type FetchJsonResult<T> = { data: T; status: number; headers: Headers };

const RETRYABLE_STATUS = new Set([408, 425, 500, 502, 503, 504]);
const BODY_EXCERPT_LENGTH = 500;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Reads Retry-After (seconds or HTTP date), then x-ratelimit-reset (seconds). */
export function parseRetryAfter(headers: Headers, now: Date = new Date()): number | null {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds;
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - now.getTime()) / 1000));
  }
  const reset = Number(headers.get("x-ratelimit-reset"));
  return Number.isFinite(reset) && reset > 0 ? reset : null;
}

function retryDelay(error: ExternalApiError, attempt: number, policy: RetryPolicy): number {
  if (error instanceof RateLimitedError && error.retryAfterSeconds !== null) {
    return Math.min(error.retryAfterSeconds * 1000, policy.maxDelayMs);
  }
  return Math.min(policy.baseDelayMs * 2 ** attempt, policy.maxDelayMs);
}

async function attempt<T>(
  options: FetchJsonOptions<T>,
  method: "GET" | "POST",
): Promise<FetchJsonResult<T>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeout = AbortSignal.timeout(options.timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const hasBody = options.body !== undefined;

  let response: Response;
  try {
    response = await fetchImpl(options.url, {
      method,
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal,
    });
  } catch (cause) {
    const callerAborted = options.signal?.aborted ?? false;
    const message = callerAborted
      ? "Request aborted by caller"
      : timeout.aborted
        ? `Timeout after ${options.timeoutMs} ms`
        : "Network error";
    throw new ExternalApiError(options.source, message, {
      status: null,
      cause,
      retryable: !callerAborted,
    });
  }

  const text = await response.text();
  if (!response.ok) {
    const bodyExcerpt = text.slice(0, BODY_EXCERPT_LENGTH);
    if (response.status === 429 || response.status === 419) {
      throw new RateLimitedError(options.source, parseRetryAfter(response.headers), {
        status: response.status,
        bodyExcerpt,
      });
    }
    throw new ExternalApiError(options.source, `HTTP ${response.status}`, {
      status: response.status,
      bodyExcerpt,
      retryable: RETRYABLE_STATUS.has(response.status),
    });
  }

  let json: unknown;
  try {
    json = text.length > 0 ? JSON.parse(text) : null;
  } catch (cause) {
    throw new ExternalApiError(options.source, "Invalid JSON response", {
      status: response.status,
      cause,
      bodyExcerpt: text.slice(0, 200),
    });
  }

  const parsed = options.schema.safeParse(json);
  if (!parsed.success) {
    throw new ExternalApiError(options.source, "Unexpected response shape", {
      status: response.status,
      issues: toValidationIssues(parsed.error),
    });
  }
  return { data: parsed.data, status: response.status, headers: response.headers };
}

/**
 * Calls an external JSON API with a timeout, Zod validation of the response and typed errors.
 * Retries retryable failures (network, timeout, 429, 5xx) with exponential backoff and Retry-After.
 */
export async function fetchJson<T>(options: FetchJsonOptions<T>): Promise<FetchJsonResult<T>> {
  const method = options.method ?? "GET";
  const policy: RetryPolicy = {
    maxRetries: method === "GET" ? 2 : 0,
    baseDelayMs: 500,
    maxDelayMs: 10_000,
    ...options.retry,
  };
  const sleep = options.sleep ?? defaultSleep;
  const log = options.logger ?? defaultLogger;

  for (let retries = 0; ; retries++) {
    try {
      return await attempt(options, method);
    } catch (error) {
      if (
        !(error instanceof ExternalApiError) ||
        !error.retryable ||
        retries >= policy.maxRetries
      ) {
        throw error;
      }
      const delayMs = retryDelay(error, retries, policy);
      log.warn("external_api_retry", {
        source: options.source,
        status: error.status,
        retry: retries + 1,
        delayMs,
      });
      await sleep(delayMs);
    }
  }
}
