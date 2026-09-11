import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, createMigratedDb } from "./setup";

const USER = "00000000-0000-0000-0000-0000000000dd";
const OTHER = "00000000-0000-0000-0000-0000000000ee";
let db: PGlite;

beforeAll(async () => {
  db = await createMigratedDb();
  await db.exec(`
    insert into auth.users (id) values ('${USER}'), ('${OTHER}');
    insert into public.offers (id, source, external_id, title, apply_channel, apply_target, raw) values
      ('10000000-0000-0000-0000-0000000000a1', 'api_alternance', 'e:1', 't', 'external_url', 'https://example.org', '{}'),
      ('10000000-0000-0000-0000-0000000000a2', 'api_alternance', 'e:2', 't', 'external_url', 'https://example.org', '{}');
    insert into public.applications (user_id, offer_id, status, sent_at, sent_via, next_follow_up_at) values
      ('${USER}', '10000000-0000-0000-0000-0000000000a1', 'sent', now() - interval '15 days', 'partner_site', now() - interval '10 days'),
      ('${USER}', '10000000-0000-0000-0000-0000000000a2', 'sent', now() - interval '2 days', 'partner_site', now() + interval '3 days');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("daily_maintenance", () => {
  it("marks applications without answer after 14 days and logs it", async () => {
    const result = (
      await db.query<{ result: { unanswered: number } }>(
        "select public.daily_maintenance() as result",
      )
    ).rows[0]?.result;
    expect(result?.unanswered).toBe(1);
    const statuses = (
      await db.query<{ status: string; next_follow_up_at: string | null }>(
        "select status, next_follow_up_at from public.applications order by sent_at",
      )
    ).rows;
    expect(statuses.map((row) => row.status)).toEqual(["no_answer", "sent"]);
    expect(statuses[0]?.next_follow_up_at).toBeNull();
    const events = (await db.query("select type from public.events where user_id = $1", [USER]))
      .rows;
    expect(events).toHaveLength(1);
  });

  it("cannot be run by users", async () => {
    await asRole(db, "authenticated", USER, async () => {
      await expect(db.query("select public.daily_maintenance()")).rejects.toThrow(
        /permission denied/,
      );
    });
  });
});

describe("check_rate_limit", () => {
  const hit = async () =>
    (
      await db.query<{ ok: boolean }>(
        "select public.check_rate_limit('refresh_offers', 2, 600) as ok",
      )
    ).rows[0]?.ok;

  it("counts per signed-in user and blocks beyond the limit", async () => {
    await asRole(db, "authenticated", USER, async () => {
      expect([await hit(), await hit(), await hit()]).toEqual([true, true, false]);
    });
    await asRole(db, "authenticated", OTHER, async () => {
      expect(await hit()).toBe(true);
    });
  });

  it("refuses anonymous callers and direct access to the counters", async () => {
    await asRole(db, "anon", null, async () => {
      await expect(hit()).rejects.toThrow(/permission denied/);
    });
    await asRole(db, "authenticated", USER, async () => {
      await expect(db.query("select * from public.rate_limits")).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query("select public.check_rate_limit('Bad Name', 1, 60)")).rejects.toThrow(
        /invalid rate limit/,
      );
    });
  });
});
