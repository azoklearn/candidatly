import { getLogLevel, type LogLevelName } from "@/lib/env";

/**
 * Structured JSON logger, the only place allowed to use console.
 * Secrets are redacted by key and long strings (CV, letters) are truncated.
 */

export type LogLevel = LogLevelName;
export type LogFields = Record<string, unknown>;
export type LogWriter = (level: LogLevel, line: string) => void;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SECRET_KEY =
  /authorization|cookie|password|passwd|secret|token|api[-_]?key|access[-_]?key|credential/i;
const MAX_STRING_LENGTH = 1_000;
const MAX_ARRAY_LENGTH = 50;
const MAX_DEPTH = 5;

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}[truncated ${value.length - MAX_STRING_LENGTH} chars]`
      : value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return value;
  if (value instanceof Error) {
    const code = "code" in value ? (value as { code: unknown }).code : undefined;
    return { name: value.name, message: value.message, ...(code === undefined ? {} : { code }) };
  }
  if (depth >= MAX_DEPTH) return "[depth limit]";
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => redact(item, depth + 1));
  }
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SECRET_KEY.test(key) ? "[REDACTED]" : redact(item, depth + 1);
  }
  return output;
}

function defaultWriter(level: LogLevel, line: string): void {
  if (level === "warn" || level === "error") console.error(line);
  else console.log(line);
}

export function createLogger(
  base: LogFields = {},
  options: { level?: LogLevel; write?: LogWriter } = {},
): Logger {
  const minLevel = options.level ?? getLogLevel();
  const write = options.write ?? defaultWriter;

  const emit = (level: LogLevel, message: string, fields?: LogFields) => {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) return;
    const context = redact({ ...base, ...fields }) as LogFields;
    write(
      level,
      JSON.stringify({ level, time: new Date().toISOString(), msg: message, ...context }),
    );
  };

  return {
    debug: (message, fields) => emit("debug", message, fields),
    info: (message, fields) => emit("info", message, fields),
    warn: (message, fields) => emit("warn", message, fields),
    error: (message, fields) => emit("error", message, fields),
    child: (fields) => createLogger({ ...base, ...fields }, { level: minLevel, write }),
  };
}

export const logger = createLogger({ app: "candidatly" });
