import { beforeEach, describe, expect, it } from "vitest";

import { isGoogleSignInEnabled, resetAuthSettingsCache } from "@/lib/auth/providers";

const config = { url: "https://example.supabase.co", key: "sb_publishable_test" };

function fakeSettings(body: unknown, status = 200) {
  const calls: { url: string; apikey: string | null }[] = [];
  const fetchImpl = async (input: URL | string, init?: RequestInit) => {
    calls.push({ url: String(input), apikey: new Headers(init?.headers).get("apikey") });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return { calls, fetchImpl };
}

beforeEach(() => resetAuthSettingsCache());

describe("isGoogleSignInEnabled", () => {
  it("reads the project's public auth settings", async () => {
    const api = fakeSettings({ external: { google: true, email: true } });
    expect(await isGoogleSignInEnabled({ config, fetchImpl: api.fetchImpl })).toBe(true);
    expect(api.calls).toEqual([
      { url: "https://example.supabase.co/auth/v1/settings", apikey: "sb_publishable_test" },
    ]);
  });

  it("hides Google when it is disabled, when the settings fail or without a project", async () => {
    expect(
      await isGoogleSignInEnabled({
        config,
        fetchImpl: fakeSettings({ external: { google: false } }).fetchImpl,
      }),
    ).toBe(false);
    resetAuthSettingsCache();
    expect(
      await isGoogleSignInEnabled({
        config,
        fetchImpl: fakeSettings({ message: "down" }, 500).fetchImpl,
      }),
    ).toBe(false);
    const unused = fakeSettings({ external: { google: true } });
    expect(await isGoogleSignInEnabled({ config: null, fetchImpl: unused.fetchImpl })).toBe(false);
    expect(unused.calls).toHaveLength(0);
  });

  it("keeps the answer for five minutes", async () => {
    const api = fakeSettings({ external: { google: true } });
    await isGoogleSignInEnabled({ config, fetchImpl: api.fetchImpl, now: 0 });
    await isGoogleSignInEnabled({ config, fetchImpl: api.fetchImpl, now: 4 * 60 * 1000 });
    expect(api.calls).toHaveLength(1);
    await isGoogleSignInEnabled({ config, fetchImpl: api.fetchImpl, now: 6 * 60 * 1000 });
    expect(api.calls).toHaveLength(2);
  });
});
