import { describe, expect, it } from "vitest";

import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { parseCronEnv } from "@/lib/env";
import { ConfigError } from "@/lib/errors";

const SECRET = "a".repeat(64);

describe("isAuthorizedCronRequest", () => {
  it("accepts the exact bearer secret only", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}b`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer ", SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer x", "")).toBe(false);
  });

  it("requires a secret of at least 32 characters", () => {
    expect(parseCronEnv({ CRON_SECRET: SECRET }).CRON_SECRET).toBe(SECRET);
    expect(() => parseCronEnv({ CRON_SECRET: "short" })).toThrow(ConfigError);
    expect(() => parseCronEnv({ CRON_SECRET: "" })).toThrow(/CRON_SECRET/);
  });
});
