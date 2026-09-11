import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, createMigratedDb } from "./setup";

let db: PGlite;

beforeAll(async () => {
  db = await createMigratedDb();
  // Stand-ins for Supabase Vault and pg_net, which PGlite does not have.
  await db.exec(`
    create schema vault;
    create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
    create schema net;
    create table net.calls (url text, body jsonb, headers jsonb, timeout_milliseconds integer);
    create function net.http_post(
      url text,
      body jsonb default '{}'::jsonb,
      params jsonb default '{}'::jsonb,
      headers jsonb default '{}'::jsonb,
      timeout_milliseconds integer default 5000
    ) returns bigint language sql as $$
      insert into net.calls values (url, body, headers, timeout_milliseconds) returning 1::bigint
    $$;
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const invoke = async () =>
  (await db.query<{ result: string }>("select public.invoke_offer_sync() as result")).rows[0]
    ?.result;

type Call = { url: string; headers: Record<string, string>; timeout_milliseconds: number };
const calls = async () =>
  (await db.query<Call>("select url, headers, timeout_milliseconds from net.calls")).rows;

describe("invoke_offer_sync", () => {
  it("does nothing until the site URL and the secret are in Vault", async () => {
    expect(await invoke()).toBe("not_configured");
    expect(await calls()).toEqual([]);
  });

  it("calls the protected sync route with the shared secret", async () => {
    await db.exec(`
      insert into vault.decrypted_secrets values
        ('candidatly_site_url', 'https://candidatly.example/'),
        ('candidatly_cron_secret', 'test-secret');
    `);
    expect(await invoke()).toBe("requested");
    const [call] = await calls();
    expect(call?.url).toBe("https://candidatly.example/api/cron/sync-offers");
    expect(call?.headers.Authorization).toBe("Bearer test-secret");
    expect(call?.timeout_milliseconds).toBe(60000);
  });

  it("cannot be called by signed-in or anonymous users", async () => {
    for (const role of ["authenticated", "anon"] as const) {
      await asRole(db, role, null, async () => {
        await expect(db.query("select public.invoke_offer_sync()")).rejects.toThrow(
          /permission denied/,
        );
      });
    }
  });
});
