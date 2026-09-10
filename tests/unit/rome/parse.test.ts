import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  normalizeSearchText,
  parseAppellations,
  parseCsv,
  parseDomaines,
  parseGrandDomaines,
  parseRomeCodes,
  parseVersion,
} from "@/lib/rome/parse";

const read = (name: string) =>
  readFileSync(new URL(`../../../docs/reference/rome/${name}`, import.meta.url), "utf8");

describe("ROME open data parsing", () => {
  it("reads the version file", () => {
    expect(parseVersion(read("rome-version-61-version.txt"))).toEqual({
      version: 61,
      publishedAt: "2026-06-15",
      validatedAt: "2026-04-27",
      comment: "ROME 4.0 version 61 - 26M06",
    });
  });

  it("reads the whole nomenclature", () => {
    expect(parseGrandDomaines(read("rome-grand-domaine-v461-utf8.csv"))).toHaveLength(14);
    const domaines = parseDomaines(read("rome-domaine-professionnel-v461-utf8.csv"));
    expect(domaines).toHaveLength(110);
    expect(domaines[0]).toEqual({
      code: "A11",
      grandDomaine: "A",
      label: "Engins agricoles et forestiers",
    });
    const codes = parseRomeCodes(read("rome-referentiel-code-rome-v461-utf8.csv"));
    expect(codes).toHaveLength(1911);
    expect(codes.find((c) => c.code === "M1805")).toMatchObject({
      label: "Développeur / Développeuse informatique",
      domaineProfessionnel: "M18",
      searchText: "developpeur developpeuse informatique",
    });
    const appellations = parseAppellations(read("rome-referentiel-appellation-v461-utf8.csv"));
    expect(appellations).toHaveLength(14301);
    expect(appellations.filter((a) => a.peuUsite)).toHaveLength(467);
  });

  it("handles quotes, commas and line breaks inside fields", () => {
    expect(parseCsv('"a","b, c","d ""e"""\n"f\ng","h"\n')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["f\ng", "h"],
    ]);
  });

  it("normalises search text without accents", () => {
    expect(normalizeSearchText("Développeur / Développeuse web")).toBe(
      "developpeur developpeuse web",
    );
    expect(normalizeSearchText("Manœuvre du BTP")).toBe("manoeuvre du btp");
    expect(normalizeSearchText("  Chargé(e) de com'  ")).toBe("charge e de com");
  });
});
