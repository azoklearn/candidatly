import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, createMigratedDb } from "./setup";

const USER = "00000000-0000-0000-0000-0000000000cc";
let db: PGlite;

beforeAll(async () => {
  db = await createMigratedDb();
  await db.exec(`
    insert into auth.users (id) values ('${USER}');
    insert into public.offers (source, external_id, title, apply_channel, apply_target, raw, company_siret, company_name, is_delegated) values
      ('api_alternance', 'a:1', 't', 'external_url', 'https://example.org', '{"workplace":{"description":"Atelier de menuiserie"}}', '11111111100011', 'Alpha', false),
      ('api_alternance', 'a:2', 't', 'external_url', 'https://example.org', '{}', '22222222200022', 'Beta', false),
      ('api_alternance', 'a:3', 't', 'external_url', 'https://example.org', '{}', '33333333300033', 'Gamma', true),
      ('api_alternance', 'a:4', 't', 'external_url', 'https://example.org', '{}', '44444444400044', 'Delta', false),
      ('api_alternance', 'a:5', 't', 'external_url', 'https://example.org', '{}', null, 'Epsilon', false);
    insert into public.companies (siret, siren) values ('22222222200022', '222222222');
    insert into public.company_lookups (key, siret, status) values ('siret:44444444400044', null, 'not_found');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

async function errorOf(sql: string): Promise<string> {
  try {
    await db.exec(sql);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("pending_company_sirets", () => {
  it("lists employers of live, non delegated offers that are neither known nor recently searched", async () => {
    const rows = (await db.query("select * from public.pending_company_sirets(10)")).rows;
    expect(rows).toEqual([
      {
        siret: "11111111100011",
        company_name: "Alpha",
        company_website: null,
        postal_code: null,
        company_description: "Atelier de menuiserie",
      },
    ]);
  });
});

describe("company_lookups", () => {
  it("is readable by signed-in users, written only by the service role", async () => {
    await asRole(db, "authenticated", USER, async () => {
      expect((await db.query("select key from public.company_lookups")).rows).toHaveLength(1);
      expect(
        await errorOf(
          `insert into public.company_lookups (key, status) values ('name:x|', 'not_found')`,
        ),
      ).toMatch(/permission denied/);
      expect(await errorOf("select * from public.pending_company_sirets(1)")).toMatch(
        /permission denied/,
      );
    });
    await asRole(db, "anon", null, async () => {
      expect(await errorOf("select key from public.company_lookups")).toMatch(/permission denied/);
    });
  });

  it("keeps keys, statuses and SIRET numbers consistent", async () => {
    expect(
      await errorOf(`insert into public.company_lookups (key, status) values ('siret:1', 'found')`),
    ).toMatch(/company_lookups_found_has_siret/);
    expect(
      await errorOf(
        `insert into public.company_lookups (key, status) values ('other', 'not_found')`,
      ),
    ).toMatch(/company_lookups_key_format/);
    expect(
      await errorOf(
        `insert into public.company_lookups (key, siret, status) values ('siret:1', '1', 'found')`,
      ),
    ).toMatch(/company_lookups_siret_format/);
  });
});
