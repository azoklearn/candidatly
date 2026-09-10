/**
 * Imports the official ROME nomenclature (docs/reference/rome) into Supabase.
 * Usage: npm run rome:import [-- --force]. Needs NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SECRET_KEY (read from .env.local). Codes and appellations missing from
 * the new version are deactivated, never deleted: profiles may still reference them.
 */
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import {
  parseAppellations,
  parseDomaines,
  parseGrandDomaines,
  parseRomeCodes,
  parseVersion,
} from "../lib/rome/parse.ts";
import type { Database } from "../lib/supabase/database.types.ts";

const SOURCE_DIR = new URL("../docs/reference/rome/", import.meta.url);
const CHUNK = 1000;

const read = (name: string) => readFileSync(new URL(name, SOURCE_DIR), "utf8");

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required (.env.local).");
  }
  const db = createClient<Database>(url, secretKey, { auth: { persistSession: false } });

  const version = parseVersion(read("rome-version-61-version.txt"));
  const latest = await db
    .from("rome_versions")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest.error) throw new Error(`rome_versions: ${latest.error.message}`);
  if (latest.data && latest.data.version >= version.version && !process.argv.includes("--force")) {
    console.log(`ROME version ${latest.data.version} already imported. Use --force to re-import.`);
    return;
  }

  const grandDomaines = parseGrandDomaines(read("rome-grand-domaine-v461-utf8.csv"));
  const domaines = parseDomaines(read("rome-domaine-professionnel-v461-utf8.csv"));
  const codes = parseRomeCodes(read("rome-referentiel-code-rome-v461-utf8.csv"));
  const appellations = parseAppellations(read("rome-referentiel-appellation-v461-utf8.csv"));

  const check = (label: string, error: { message: string } | null) => {
    if (error) throw new Error(`${label}: ${error.message}`);
  };

  check(
    "rome_versions",
    (
      await db.from("rome_versions").upsert(
        {
          version: version.version,
          published_at: version.publishedAt,
          validated_at: version.validatedAt,
          comment: version.comment,
          imported_at: new Date().toISOString(),
        },
        { onConflict: "version" },
      )
    ).error,
  );
  check(
    "rome_grand_domaines",
    (await db.from("rome_grand_domaines").upsert(grandDomaines, { onConflict: "code" })).error,
  );
  check(
    "rome_domaines_professionnels",
    (
      await db.from("rome_domaines_professionnels").upsert(
        domaines.map((d) => ({ code: d.code, grand_domaine: d.grandDomaine, label: d.label })),
        { onConflict: "code" },
      )
    ).error,
  );
  for (const part of chunks(codes, CHUNK)) {
    check(
      "rome_codes",
      (
        await db.from("rome_codes").upsert(
          part.map((c) => ({
            code: c.code,
            label: c.label,
            domaine_professionnel: c.domaineProfessionnel,
            code_rome_parent: c.codeRomeParent,
            transition_eco: c.transitionEco,
            transition_num: c.transitionNum,
            transition_demo: c.transitionDemo,
            emploi_reglemente: c.emploiReglemente,
            emploi_cadre: c.emploiCadre,
            search_text: c.searchText,
            rome_version: version.version,
            is_active: true,
          })),
          { onConflict: "code" },
        )
      ).error,
    );
  }
  for (const part of chunks(appellations, CHUNK)) {
    check(
      "rome_appellations",
      (
        await db.from("rome_appellations").upsert(
          part.map((a) => ({
            code_ogr: a.codeOgr,
            code_rome: a.codeRome,
            label_long: a.labelLong,
            label_short: a.labelShort,
            classification: a.classification,
            peu_usite: a.peuUsite,
            search_text: a.searchText,
            rome_version: version.version,
            is_active: true,
          })),
          { onConflict: "code_ogr" },
        )
      ).error,
    );
  }
  check(
    "deactivate old codes",
    (await db.from("rome_codes").update({ is_active: false }).lt("rome_version", version.version))
      .error,
  );
  check(
    "deactivate old appellations",
    (
      await db
        .from("rome_appellations")
        .update({ is_active: false })
        .lt("rome_version", version.version)
    ).error,
  );

  console.log(
    `ROME version ${version.version} imported: ${grandDomaines.length} grands domaines, ${domaines.length} domaines, ${codes.length} codes, ${appellations.length} appellations.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
