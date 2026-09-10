import { describe, expect, it } from "vitest";

import { createLogger, redact } from "@/lib/logger";

function capture() {
  const lines: Array<{ level: string; entry: Record<string, unknown> }> = [];
  const logger = createLogger(
    { app: "test" },
    { level: "info", write: (level, line) => lines.push({ level, entry: JSON.parse(line) }) },
  );
  return { logger, lines };
}

describe("logger", () => {
  it("writes one JSON line with base and call fields", () => {
    const { logger, lines } = capture();
    logger.child({ job: "sync-offers" }).info("done", { offers: 3 });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.entry).toMatchObject({
      level: "info",
      msg: "done",
      app: "test",
      job: "sync-offers",
      offers: 3,
    });
  });

  it("drops entries below the minimum level", () => {
    const { logger, lines } = capture();
    logger.debug("noise");
    expect(lines).toHaveLength(0);
  });

  it("redacts secrets by key, at any depth", () => {
    const { logger, lines } = capture();
    logger.error("call failed", {
      headers: { Authorization: "Bearer abc", accept: "json" },
      apiKey: "k",
      nested: { refresh_token: "t", password: "p" },
    });
    const entry = lines[0]?.entry;
    expect(entry?.headers).toEqual({ Authorization: "[REDACTED]", accept: "json" });
    expect(entry?.apiKey).toBe("[REDACTED]");
    expect(entry?.nested).toEqual({ refresh_token: "[REDACTED]", password: "[REDACTED]" });
  });

  it("truncates long strings such as CV text", () => {
    const value = redact("x".repeat(5_000));
    expect(typeof value).toBe("string");
    expect((value as string).length).toBeLessThan(1_100);
    expect(value as string).toContain("[truncated 4000 chars]");
  });

  it("serialises errors without their stack", () => {
    const error = Object.assign(new Error("boom"), { code: "E_TEST" });
    expect(redact(error)).toEqual({ name: "Error", message: "boom", code: "E_TEST" });
  });
});
