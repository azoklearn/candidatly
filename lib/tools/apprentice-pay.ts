/**
 * Legal minimum pay of a work-study student in France (docs/QUESTIONS.md C122). Rules and
 * figures checked on 19 November 2026 against the official pages below; when the SMIC
 * changes, only the three constants need updating.
 *
 * - SMIC: https://www.service-public.gouv.fr/particuliers/vosdroits/F2300
 * - Apprenticeship: https://www.service-public.gouv.fr/particuliers/vosdroits/F2918
 * - Professionalisation: https://www.service-public.gouv.fr/particuliers/vosdroits/F15478
 */

/** Gross monthly SMIC for 35 hours a week, in euro cents. Mainland France, not Mayotte. */
export const SMIC_MONTHLY_CENTS = 186_702;
export const SMIC_HOURLY_CENTS = 1_231;
/** Date the SMIC above came into force (order of 22 May 2026). */
export const SMIC_SINCE = "2026-06-01";

export const PAY_SOURCES = [
  {
    label: "Smic (Service-Public)",
    href: "https://www.service-public.gouv.fr/particuliers/vosdroits/F2300",
  },
  {
    label: "Contrat d’apprentissage (Service-Public)",
    href: "https://www.service-public.gouv.fr/particuliers/vosdroits/F2918",
  },
  {
    label: "Contrat de professionnalisation (Service-Public)",
    href: "https://www.service-public.gouv.fr/particuliers/vosdroits/F15478",
  },
] as const;

export const AGE_BRACKETS = ["under18", "18-20", "21-25", "26+"] as const;
export type AgeBracket = (typeof AGE_BRACKETS)[number];
export const AGE_LABELS: Record<AgeBracket, string> = {
  under18: "Moins de 18 ans",
  "18-20": "18 à 20 ans",
  "21-25": "21 à 25 ans",
  "26+": "26 ans et plus",
};

export type PayInput =
  | { contract: "apprentissage"; age: AgeBracket; year: 1 | 2 | 3 }
  | {
      contract: "professionnalisation";
      age: AgeBracket;
      /** Already holds a vocational baccalauréat, or a title or diploma of that level or above. */
      qualified: boolean;
    };

export type PayResult = {
  /** Share of the SMIC, in percent. */
  percent: number;
  /** Gross monthly minimum for a full-time contract, in euro cents. */
  monthlyCents: number;
  /** From 21: the minimum of the collective agreement applies when it is higher. */
  agreementMayApply: boolean;
};

/** Apprenticeship: percent of the SMIC by age bracket, for years 1, 2 and 3. */
const APPRENTICESHIP: Record<AgeBracket, readonly [number, number, number]> = {
  under18: [27, 39, 55],
  "18-20": [43, 51, 67],
  "21-25": [53, 61, 78],
  "26+": [100, 100, 100],
};

export function minimumPay(input: PayInput): PayResult {
  let percent: number;
  if (input.contract === "apprentissage") {
    percent = APPRENTICESHIP[input.age][input.year - 1] ?? 100;
  } else if (input.age === "26+") {
    percent = 100;
  } else if (input.age === "21-25") {
    percent = input.qualified ? 80 : 70;
  } else {
    percent = input.qualified ? 65 : 55;
  }
  return {
    percent,
    monthlyCents: Math.round((SMIC_MONTHLY_CENTS * percent) / 100),
    agreementMayApply: input.age === "21-25" || input.age === "26+",
  };
}
