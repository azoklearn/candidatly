import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { normalizeSearchText } from "@/lib/rome/parse";

import { asRole, createMigratedDb } from "./setup";

let db: PGlite;
const USER = "00000000-0000-0000-0000-0000000000aa";

const codes = [
  ["M1805", "Développeur / Développeuse informatique"],
  ["M1855", "Développeur / Développeuse web"],
  ["M1705", "Responsable marketing"],
] as const;
const appellations = [
  [1, "M1855", "Développeur / Développeuse front-end", false],
  [2, "M1855", "Intégrateur / Intégratrice web", false],
  [3, "M1805", "Programmeur / Programmeuse", false],
  [4, "M1705", "Chargé / Chargée de marketing digital", false],
  [5, "M1705", "Webmarketeur / Webmarketeuse", true],
] as const;

beforeAll(async () => {
  db = await createMigratedDb();
  await db.exec(`
    insert into auth.users (id) values ('${USER}');
    insert into public.rome_versions (version) values (61);
    insert into public.rome_grand_domaines (code, label) values ('M', 'Support');
    insert into public.rome_domaines_professionnels (code, grand_domaine, label) values ('M18', 'M', 'SI'), ('M17', 'M', 'Marketing');
  `);
  for (const [code, label] of codes) {
    await db.query(
      `insert into public.rome_codes (code, label, domaine_professionnel, rome_version, search_text) values ($1, $2, $3, 61, $4)`,
      [code, label, code.slice(0, 3), normalizeSearchText(label)],
    );
  }
  for (const [ogr, code, label, rare] of appellations) {
    await db.query(
      `insert into public.rome_appellations (code_ogr, code_rome, label_long, label_short, classification, peu_usite, rome_version, search_text) values ($1, $2, $3, $3, 'SYNONYME', $4, 61, $5)`,
      [ogr, code, label, rare, normalizeSearchText(label)],
    );
  }
}, 60_000);

afterAll(async () => {
  await db?.close();
});

type Candidate = { code: string; label: string; appellations: string[]; rank: number };

async function search(terms: string[]): Promise<Candidate[]> {
  return (
    await db.query<Candidate>(`select * from public.search_rome_candidates($1::text[], 10)`, [
      terms,
    ])
  ).rows;
}

describe("search_rome_candidates", () => {
  it("ranks the web developer code first for 'developpeur web'", async () => {
    const results = await search(["developpeur", "web"]);
    expect(results[0]?.code).toBe("M1855");
    expect(results.map((r) => r.code)).toContain("M1805");
    expect(results[0]?.appellations.length).toBeGreaterThan(0);
  });

  it("matches word prefixes and ignores accents", async () => {
    expect((await search(["integrat"])).map((r) => r.code)).toEqual(["M1855"]);
    expect((await search(["marketing"])).map((r) => r.code)).toEqual(["M1705"]);
  });

  it("returns nothing for empty or unsafe terms", async () => {
    expect(await search([])).toEqual([]);
    expect(await search(["x", "a'b", "); drop table public.rome_codes; --"])).toEqual([]);
  });

  it("is callable by signed-in users only", async () => {
    await asRole(db, "authenticated", USER, async () => {
      expect((await search(["programmeur"])).map((r) => r.code)).toEqual(["M1805"]);
    });
    await asRole(db, "anon", null, async () => {
      await expect(search(["programmeur"])).rejects.toThrow(/permission denied/);
    });
  });
});
