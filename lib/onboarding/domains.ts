/**
 * The domains shown at step 2 of the questionnaire (docs/QUESTIONS.md C92). Each one holds
 * official ROME 4.0 codes, chosen among those an apprentice or an intern can realistically
 * apply to; the labels shown to the student come from the nomenclature itself.
 */

export type JobDomain = {
  id: string;
  label: string;
  hint: string;
  codes: readonly string[];
};

export const JOB_DOMAINS: readonly JobDomain[] = [
  {
    id: "informatique",
    label: "Informatique et numérique",
    hint: "Développement, data, réseaux, cybersécurité",
    codes: ["M1805", "M1855", "M1811", "M1819", "M1810", "M1816", "M1864", "M1886"],
  },
  {
    id: "commerce",
    label: "Commerce et vente",
    hint: "Relation client, vente, e-commerce",
    codes: ["D1401", "D1410", "D1407", "D1403", "D1408", "D1438", "D1415", "D1429"],
  },
  {
    id: "marketing",
    label: "Marketing et communication",
    hint: "Marketing digital, réseaux sociaux, événementiel",
    codes: ["M1718", "M1703", "E1112", "E1101", "E1124", "E1405", "E1404", "E1107"],
  },
  {
    id: "gestion",
    label: "Comptabilité et gestion",
    hint: "Comptabilité, contrôle de gestion, audit",
    codes: ["M1203", "M1213", "M1204", "M1201", "M1202", "M1225", "M1222", "M1209"],
  },
  {
    id: "rh",
    label: "Ressources humaines",
    hint: "Recrutement, formation, paie",
    codes: ["M1501", "M1502", "M1505", "M1507", "M1508", "M1504", "M1510", "M1511"],
  },
  {
    id: "banque",
    label: "Banque, finance et assurance",
    hint: "Conseil clientèle, crédit, assurances",
    codes: ["C1201", "C1206", "C1203", "C1202", "C1205", "C1109", "C1102", "C1107"],
  },
  {
    id: "logistique",
    label: "Transport et logistique",
    hint: "Logistique, transit, entrepôt",
    codes: ["N1209", "N1210", "N1303", "N1202", "N1204", "N1110", "N1103", "N1301"],
  },
  {
    id: "industrie",
    label: "Industrie et maintenance",
    hint: "Méthodes, bureau d’études, maintenance",
    codes: ["H1404", "H1403", "H1210", "H1203", "H1208", "H1402", "I1210", "H1401"],
  },
  {
    id: "batiment",
    label: "Bâtiment et travaux publics",
    hint: "Études, chantier, conduite de travaux",
    codes: ["F1104", "F1108", "F1201", "F1202", "F1206", "F1106", "F1107", "F1109"],
  },
  {
    id: "sante",
    label: "Santé et social",
    hint: "Soins, éducation spécialisée, action sociale",
    codes: ["J1501", "J1506", "K1202", "K1207", "K1208", "K1201", "K1205", "K1204"],
  },
  {
    id: "hotellerie",
    label: "Hôtellerie, restauration et tourisme",
    hint: "Cuisine, salle, accueil, voyages",
    codes: ["G1602", "G1609", "G1803", "G1810", "G1801", "G1101", "G1303", "G1305"],
  },
  {
    id: "droit",
    label: "Droit et administration",
    hint: "Juridique, assistanat, secrétariat",
    codes: ["K1903", "K1902", "K1906", "M1604", "M1607", "M1601", "M1602", "M1608"],
  },
];

export function findDomain(id: string | null | undefined): JobDomain | null {
  return JOB_DOMAINS.find((domain) => domain.id === id) ?? null;
}

/** The chosen domain is stored as its label, the same field as the free text of the account page. */
export function findDomainByLabel(label: string | null | undefined): JobDomain | null {
  const value = (label ?? "").trim().toLowerCase();
  return JOB_DOMAINS.find((domain) => domain.label.toLowerCase() === value) ?? null;
}
