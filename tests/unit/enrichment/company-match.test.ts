import { describe, expect, it } from "vitest";

import {
  nameSimilarity,
  normalizeCompanyName,
  pickCompanyMatch,
  publicValue,
} from "@/lib/enrichment/company-match";
import type { CompanyRecord, Establishment } from "@/lib/enrichment/recherche-entreprises";

const establishment = (
  siret: string,
  postal: string,
  extra: Partial<Establishment> = {},
): Establishment => ({
  siret,
  adresse: null,
  code_postal: postal,
  libelle_commune: null,
  activite_principale: null,
  tranche_effectif_salarie: null,
  etat_administratif: "A",
  nom_commercial: null,
  liste_enseignes: [],
  statut_diffusion_etablissement: "O",
  ...extra,
});

const record = (
  name: string,
  siege: Establishment,
  matching: Establishment[] = [],
): CompanyRecord => ({
  siren: siege.siret.slice(0, 9),
  nom_complet: name,
  nom_raison_sociale: name,
  sigle: null,
  activite_principale: "62.01Z",
  activite_principale_naf25: null,
  categorie_entreprise: "PME",
  date_creation: "2022-01-10",
  date_mise_a_jour: null,
  date_mise_a_jour_rne: null,
  etat_administratif: "A",
  tranche_effectif_salarie: "03",
  statut_diffusion: "O",
  siege,
  matching_etablissements: matching,
  dirigeants: [],
});

describe("company names", () => {
  it("ignores accents, punctuation and legal forms", () => {
    expect(normalizeCompanyName("HOLIS SAS")).toBe("holis");
    expect(normalizeCompanyName("Boulangerie Émile & Fils")).toBe("boulangerie emile et fils");
    expect(nameSimilarity("Link Consulting", "LINK CONSULTING SARL")).toBe(1);
    expect(nameSimilarity("Holis", "Holis Environnement")).toBeGreaterThanOrEqual(0.66);
    expect(nameSimilarity("Holis", "Carrefour")).toBe(0);
  });
});

describe("pickCompanyMatch", () => {
  const holis = record("HOLIS", establishment("91234567800012", "75013"), [
    establishment("91234567800020", "75001"),
  ]);

  it("is certain for the requested SIRET", () => {
    const match = pickCompanyMatch({ siret: "91234567800020", name: null, postalCode: null }, [
      holis,
    ]);
    expect(match?.establishment.siret).toBe("91234567800020");
    expect(match?.confidence).toBe(1);
  });

  it("needs a similar name and an establishment in the postal code", () => {
    const match = pickCompanyMatch({ siret: null, name: "Holis", postalCode: "75001" }, [holis]);
    expect(match?.establishment.siret).toBe("91234567800020");
    expect(match?.confidence).toBe(1);
    expect(
      pickCompanyMatch({ siret: null, name: "Holis", postalCode: "69001" }, [holis]),
    ).toBeNull();
    expect(
      pickCompanyMatch({ siret: null, name: "Carrefour", postalCode: "75001" }, [holis]),
    ).toBeNull();
  });

  it("never uses masked values", () => {
    const masked = record("[NON-DIFFUSIBLE]", establishment("91234567800012", "75013"));
    expect(
      pickCompanyMatch({ siret: null, name: "Jean Dupont", postalCode: "75013" }, [masked]),
    ).toBeNull();
    expect(publicValue("[NON-DIFFUSIBLE]")).toBeNull();
  });
});
