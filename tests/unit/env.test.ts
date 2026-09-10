import { describe, expect, it } from "vitest";

import { parseApiAlternanceEnv, parsePublicEnv, parseSupabaseAdminEnv } from "@/lib/env";
import { ConfigError } from "@/lib/errors";

describe("environment parsing", () => {
  it("names missing variables without exposing values", () => {
    const error = (() => {
      try {
        parseApiAlternanceEnv({ API_ALTERNANCE_KEY: "short-secret" });
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).variables).toEqual(["API_ALTERNANCE_KEY"]);
    expect((error as ConfigError).message).not.toContain("short-secret");
  });

  it("applies defaults", () => {
    const env = parseApiAlternanceEnv({ API_ALTERNANCE_KEY: "k".repeat(40) });
    expect(env.API_ALTERNANCE_BASE_URL).toBe("https://api.apprentissage.beta.gouv.fr/api");
  });

  it("treats empty strings as missing", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
      NEXT_PUBLIC_SITE_URL: "",
    });
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(() =>
      parseSupabaseAdminEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SECRET_KEY: "",
      }),
    ).toThrow(/SUPABASE_SECRET_KEY/);
  });
});
