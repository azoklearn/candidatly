import type { z } from "zod";

export type AppErrorCode =
  | "CONFIG"
  | "VALIDATION"
  | "EXTERNAL_API"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "INSUFFICIENT_CREDITS"
  | "NOT_IMPLEMENTED";

export type ValidationIssue = { path: string; message: string };

type AppErrorOptions = { cause?: unknown; retryable?: boolean };

/**
 * Base class for every error thrown by /lib. Messages are meant for logs:
 * boundaries (route handlers, server actions, jobs) translate them for users.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly retryable: boolean;

  constructor(code: AppErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.retryable = options.retryable ?? false;
  }
}

/** Missing or invalid environment variables. Lists variable names, never values. */
export class ConfigError extends AppError {
  readonly variables: readonly string[];

  constructor(message: string, variables: readonly string[]) {
    super("CONFIG", message);
    this.variables = variables;
  }
}

export class ValidationError extends AppError {
  readonly issues: readonly ValidationIssue[];

  constructor(message: string, issues: readonly ValidationIssue[]) {
    super("VALIDATION", message);
    this.issues = issues;
  }
}

type ExternalApiErrorOptions = AppErrorOptions & {
  status: number | null;
  bodyExcerpt?: string | null;
  issues?: readonly ValidationIssue[];
};

/** Failure of an external call: network, timeout, HTTP status or unexpected payload. */
export class ExternalApiError extends AppError {
  readonly source: string;
  readonly status: number | null;
  readonly bodyExcerpt: string | null;
  readonly issues: readonly ValidationIssue[];

  constructor(
    source: string,
    message: string,
    options: ExternalApiErrorOptions,
    code: AppErrorCode = "EXTERNAL_API",
  ) {
    super(code, `${source}: ${message}`, options);
    this.source = source;
    this.status = options.status;
    this.bodyExcerpt = options.bodyExcerpt ?? null;
    this.issues = options.issues ?? [];
  }
}

/** HTTP 429, or 419 (a typo of the API Alternance spec). Always retryable. */
export class RateLimitedError extends ExternalApiError {
  readonly retryAfterSeconds: number | null;

  constructor(
    source: string,
    retryAfterSeconds: number | null,
    options: Omit<ExternalApiErrorOptions, "retryable">,
  ) {
    super(source, "Rate limited", { ...options, retryable: true }, "RATE_LIMITED");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super("NOT_FOUND", message);
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(message = "Insufficient credits") {
    super("INSUFFICIENT_CREDITS", message);
  }
}

export class NotImplementedError extends AppError {
  constructor(message: string) {
    super("NOT_IMPLEMENTED", message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}
