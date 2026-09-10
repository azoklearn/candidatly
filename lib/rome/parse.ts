/**
 * Parsing of the official ROME open data CSV export (docs/ROME.md section 3).
 * Pure module without path aliases: scripts/import-rome.ts runs it with Node directly.
 */

export type RomeVersion = {
  version: number;
  publishedAt: string | null;
  validatedAt: string | null;
  comment: string | null;
};
export type RomeGrandDomaine = { code: string; label: string };
export type RomeDomaine = { code: string; grandDomaine: string; label: string };
export type RomeCode = {
  code: string;
  label: string;
  domaineProfessionnel: string;
  codeRomeParent: string | null;
  transitionEco: string | null;
  transitionNum: boolean | null;
  transitionDemo: boolean | null;
  emploiReglemente: boolean | null;
  emploiCadre: boolean | null;
  searchText: string;
};
export type RomeAppellation = {
  codeOgr: number;
  codeRome: string;
  labelLong: string;
  labelShort: string;
  classification: "PRINCIPALE" | "SYNONYME";
  peuUsite: boolean;
  searchText: string;
};

const ROME_CODE = /^[A-Z]\d{4}$/;

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (inQuotes) {
      if (char === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

type CsvRecord = { get(name: string): string };

function records(input: string): CsvRecord[] {
  const [header, ...rows] = parseCsv(input);
  if (!header) return [];
  return rows
    .filter((row) => row.some((value) => value.trim() !== ""))
    .map((row) => ({
      get: (name: string) => {
        const index = header.indexOf(name);
        return index === -1 ? "" : (row[index] ?? "").trim();
      },
    }));
}

/** Lower case, no accents, letters and digits only: the form stored in search_text. */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function flag(value: string): boolean | null {
  if (value === "O") return true;
  if (value === "N") return false;
  return null;
}

function nullable(value: string): string | null {
  return value === "" ? null : value;
}

function frenchDate(value: string | undefined): string | null {
  const match = value?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

export function parseVersion(input: string): RomeVersion {
  const field = (label: string) => input.match(new RegExp(`${label}\\s*:\\s*(.+)`))?.[1]?.trim();
  const version = Number(field("Numero de version"));
  if (!Number.isInteger(version)) throw new Error("ROME version number not found in version.txt");
  return {
    version,
    publishedAt: frenchDate(field("Date de publication")),
    validatedAt: frenchDate(field("Date de validation")),
    comment: field("Titre/commentaire") ?? null,
  };
}

export function parseGrandDomaines(input: string): RomeGrandDomaine[] {
  return records(input)
    .map((r) => ({ code: r.get("code_grand_domaine"), label: r.get("libelle_grand_domaine") }))
    .filter((d) => /^[A-Z]$/.test(d.code) && d.label !== "");
}

export function parseDomaines(input: string): RomeDomaine[] {
  return records(input)
    .map((r) => {
      const code = r.get("code_domaine_professionnel");
      return { code, grandDomaine: code.charAt(0), label: r.get("libelle_domaine_professionnel") };
    })
    .filter((d) => /^[A-Z]\d{2}$/.test(d.code) && d.label !== "");
}

export function parseRomeCodes(input: string): RomeCode[] {
  return records(input)
    .map((r) => {
      const code = r.get("code_rome");
      const label = r.get("libelle_rome");
      return {
        code,
        label,
        domaineProfessionnel: code.slice(0, 3),
        codeRomeParent: nullable(r.get("code_rome_parent")),
        transitionEco: nullable(r.get("transition_eco")),
        transitionNum: flag(r.get("transition_num")),
        transitionDemo: flag(r.get("transition_demo")),
        emploiReglemente: flag(r.get("emploi_reglemente")),
        emploiCadre: flag(r.get("emploi_cadre")),
        searchText: normalizeSearchText(label),
      };
    })
    .filter((c) => ROME_CODE.test(c.code) && c.label !== "");
}

export function parseAppellations(input: string): RomeAppellation[] {
  return records(input)
    .map((r) => {
      const labelLong = r.get("libelle_appellation_long");
      const classification = r.get("classification") === "PRINCIPALE" ? "PRINCIPALE" : "SYNONYME";
      return {
        codeOgr: Number(r.get("code_ogr")),
        codeRome: r.get("code_rome"),
        labelLong,
        labelShort: r.get("libelle_appellation_court") || labelLong,
        classification,
        peuUsite: r.get("peu_usite") === "O",
        searchText: normalizeSearchText(labelLong),
      } satisfies RomeAppellation;
    })
    .filter((a) => Number.isInteger(a.codeOgr) && ROME_CODE.test(a.codeRome) && a.labelLong !== "");
}
