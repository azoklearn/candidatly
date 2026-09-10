import { readdirSync, readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Replays supabase/migrations on PGlite (Postgres compiled to WebAssembly) with a
 * minimal stub of the Supabase roles, auth and storage schemas, then checks RLS,
 * grants and constraints. No Docker, no network.
 */

const MIGRATIONS_DIR = new URL("../../supabase/migrations/", import.meta.url);

const SUPABASE_STUB = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (
  id text primary key, name text not null, owner uuid, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[],
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
  name text, owner uuid, metadata jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
`;

const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";
const OFFER = "10000000-0000-0000-0000-000000000001";
const APPLICATION_A = "30000000-0000-0000-0000-00000000000a";

let db: PGlite;

async function count(sql: string): Promise<number> {
  return (await db.query(sql)).rows.length;
}

async function errorOf(sql: string): Promise<string> {
  try {
    await db.exec(sql);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function as(role: "authenticated" | "anon", userId: string | null, run: () => Promise<void>) {
  await db.exec(
    `set role ${role}; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);`,
  );
  try {
    await run();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS_DIR), "utf8"));
  }
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${USER_A}', 'a@example.org', '{"given_name":"Alice","family_name":"Martin"}'),
      ('${USER_B}', 'b@example.org', '{}');
    insert into public.offers (id, source, external_id, title, apply_channel, apply_target, raw)
      values ('${OFFER}', 'api_alternance', 'offres_emploi_lba:abc', 'Développeur web', 'api_alternance', 'partners_6687165396d52b5e01b40954', '{}');
    insert into public.matches (user_id, offer_id, score) values ('${USER_A}', '${OFFER}', 80), ('${USER_B}', '${OFFER}', 60);
    insert into public.applications (id, user_id, offer_id) values ('${APPLICATION_A}', '${USER_A}', '${OFFER}');
    insert into public.credit_transactions (user_id, delta, reason) values ('${USER_A}', 5, 'signup_bonus');
    insert into public.rome_versions (version) values (61);
    insert into public.rome_grand_domaines (code, label) values ('M', 'Support à l''entreprise');
    insert into public.rome_domaines_professionnels (code, grand_domaine, label) values ('M18', 'M', 'Systèmes d''information');
    insert into public.rome_codes (code, label, domaine_professionnel, rome_version) values ('M1805', 'Développeur / Développeuse informatique', 'M18', 61);
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("auth bootstrap", () => {
  it("creates a profile and a zero balance for every new user", async () => {
    expect(await count(`select 1 from public.profiles`)).toBe(2);
    expect(await count(`select 1 from public.credits where balance = 0`)).toBe(2);
  });

  it("copies names from the Google metadata", async () => {
    expect(
      await count(
        `select 1 from public.profiles where user_id = '${USER_A}' and first_name = 'Alice' and last_name = 'Martin'`,
      ),
    ).toBe(1);
  });

  it("keeps the profile email in sync with auth", async () => {
    await db.exec(`update auth.users set email = 'a2@example.org' where id = '${USER_A}'`);
    expect(
      await count(
        `select 1 from public.profiles where user_id = '${USER_A}' and email = 'a2@example.org'`,
      ),
    ).toBe(1);
  });
});

describe("row level security for a signed-in user", () => {
  it("isolates profiles and limits editable columns", async () => {
    await as("authenticated", USER_A, async () => {
      expect(await count(`select 1 from public.profiles`)).toBe(1);
      expect(
        await count(
          `update public.profiles set first_name = 'Alicia', rome_codes = '{M1805}' where user_id = '${USER_A}' returning 1`,
        ),
      ).toBe(1);
      expect(
        await count(
          `update public.profiles set first_name = 'x' where user_id = '${USER_B}' returning 1`,
        ),
      ).toBe(0);
      expect(
        await errorOf(
          `update public.profiles set email = 'x@example.org' where user_id = '${USER_A}'`,
        ),
      ).toMatch(/permission denied/);
      expect(await errorOf(`insert into public.profiles (user_id) values ('${USER_A}')`)).toMatch(
        /permission denied/,
      );
    });
  });

  it("never lets a user touch credits", async () => {
    await as("authenticated", USER_A, async () => {
      expect(await count(`select 1 from public.credits`)).toBe(1);
      expect(await count(`select 1 from public.credit_transactions`)).toBe(1);
      expect(await errorOf(`update public.credits set balance = 999`)).toMatch(/permission denied/);
      expect(
        await errorOf(
          `insert into public.credit_transactions (user_id, delta, reason) values ('${USER_A}', 100, 'refund')`,
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("serves offers read-only and limits match and application updates", async () => {
    await as("authenticated", USER_A, async () => {
      expect(await count(`select 1 from public.offers`)).toBe(1);
      expect(
        await errorOf(
          `insert into public.offers (source, external_id, title, apply_channel, apply_target, raw) values ('api_alternance', 'x:y', 't', 'external_url', 'https://example.org', '{}')`,
        ),
      ).toMatch(/permission denied/);
      expect(await count(`select 1 from public.matches`)).toBe(1);
      expect(
        await count(
          `update public.matches set status = 'saved' where user_id = '${USER_A}' returning 1`,
        ),
      ).toBe(1);
      expect(
        await errorOf(`update public.matches set score = 100 where user_id = '${USER_A}'`),
      ).toMatch(/permission denied/);
      expect(
        await count(
          `update public.applications set cover_letter_text = 'Madame, Monsieur' where user_id = '${USER_A}' returning 1`,
        ),
      ).toBe(1);
      expect(
        await errorOf(`update public.applications set status = 'sent' where user_id = '${USER_A}'`),
      ).toMatch(/permission denied/);
    });
  });

  it("keeps documents and files in the owner's folder", async () => {
    await as("authenticated", USER_A, async () => {
      expect(
        await errorOf(
          `insert into public.documents (user_id, kind, storage_path) values ('${USER_A}', 'cv', '${USER_A}/cv/cv.pdf')`,
        ),
      ).toBe("");
      expect(
        await errorOf(
          `insert into public.documents (user_id, kind, storage_path) values ('${USER_B}', 'cv', '${USER_B}/cv/cv.pdf')`,
        ),
      ).toMatch(/row-level security/);
      expect(
        await errorOf(
          `insert into public.documents (user_id, kind, storage_path) values ('${USER_A}', 'cv', '${USER_A}/cv/cv2.pdf')`,
        ),
      ).toMatch(/duplicate key/);
      expect(
        await errorOf(
          `insert into storage.objects (bucket_id, name) values ('documents', '${USER_A}/cv/cv.pdf')`,
        ),
      ).toBe("");
      expect(
        await errorOf(
          `insert into storage.objects (bucket_id, name) values ('documents', '${USER_B}/cv/cv.pdf')`,
        ),
      ).toMatch(/row-level security/);
    });
  });

  it("exposes the ROME reference read-only and hides service tables", async () => {
    await as("authenticated", USER_A, async () => {
      expect(await count(`select 1 from public.rome_codes`)).toBe(1);
      expect(await errorOf(`insert into public.rome_versions (version) values (62)`)).toMatch(
        /permission denied/,
      );
      expect(await errorOf(`select 1 from public.offer_search_runs`)).toMatch(/permission denied/);
      expect(await errorOf(`select 1 from public.stripe_events`)).toMatch(/permission denied/);
    });
  });
});

describe("anonymous visitor", () => {
  it("cannot read application data", async () => {
    await as("anon", null, async () => {
      expect(await errorOf(`select 1 from public.profiles`)).toMatch(/permission denied/);
      expect(await errorOf(`select 1 from public.offers`)).toMatch(/permission denied/);
      expect(await count(`select 1 from storage.objects`)).toBe(0);
    });
  });
});

describe("constraints", () => {
  it("validates profile fields", async () => {
    expect(
      await errorOf(`update public.profiles set rome_codes = '{M18}' where user_id = '${USER_B}'`),
    ).toMatch(/profiles_rome_codes_format/);
    expect(
      await errorOf(
        `update public.profiles set rome_codes = '{A1101,A1102,A1103,A1104,A1105,A1106}' where user_id = '${USER_B}'`,
      ),
    ).toMatch(/profiles_rome_codes_count/);
    expect(
      await errorOf(
        `update public.profiles set onboarding_completed = true where user_id = '${USER_B}'`,
      ),
    ).toMatch(/profiles_onboarding_requires_rome/);
    expect(
      await errorOf(
        `update public.profiles set search_radius_km = 500 where user_id = '${USER_B}'`,
      ),
    ).toMatch(/profiles_search_radius_range/);
  });

  it("protects documents, applications, credits and companies", async () => {
    expect(
      await errorOf(
        `insert into public.documents (user_id, kind, storage_path) values ('${USER_B}', 'cv', '${USER_A}/cv/x.pdf')`,
      ),
    ).toMatch(/documents_storage_path_owner/);
    expect(await errorOf(`update public.applications set status = 'sent'`)).toMatch(
      /applications_sent_fields/,
    );
    expect(
      await errorOf(
        `insert into public.credit_transactions (user_id, delta, reason, application_id) values ('${USER_A}', -1, 'application_sent', '${APPLICATION_A}'), ('${USER_A}', -1, 'application_sent', '${APPLICATION_A}')`,
      ),
    ).toMatch(/duplicate key/);
    expect(
      await errorOf(`update public.credits set balance = -1 where user_id = '${USER_A}'`),
    ).toMatch(/credits_balance_non_negative/);
    expect(
      await errorOf(
        `insert into public.companies (siret, siren) values ('12345678900011', '999999999')`,
      ),
    ).toMatch(/companies_siren_matches_siret/);
  });

  it("refreshes updated_at on every update", async () => {
    const read = async () =>
      (await db.query<{ updated_at: Date }>(`select updated_at from public.offers limit 1`)).rows[0]
        ?.updated_at;
    const before = await read();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await db.exec(`update public.offers set title = 'Développeur web (H/F)'`);
    const after = await read();
    expect(after?.getTime()).toBeGreaterThan(before?.getTime() ?? Infinity);
  });
});

describe("account deletion", () => {
  it("keeps offers referenced by an application", async () => {
    expect(await errorOf(`delete from public.offers`)).toMatch(/foreign key constraint/);
  });

  it("removes every row of the deleted user and nothing else", async () => {
    await db.exec(`delete from auth.users where id = '${USER_A}'`);
    for (const table of [
      "profiles",
      "documents",
      "applications",
      "credits",
      "credit_transactions",
      "matches",
    ]) {
      expect(await count(`select 1 from public.${table} where user_id = '${USER_A}'`)).toBe(0);
    }
    expect(await count(`select 1 from public.profiles where user_id = '${USER_B}'`)).toBe(1);
  });
});
