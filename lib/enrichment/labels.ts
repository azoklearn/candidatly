import { NAF_LABELS } from "./naf-labels";

/** Short headcount labels for sentences ("Entreprise de 6 à 9 salariés"), from section 7.1 codes. */
export const HEADCOUNT_LABELS: Record<string, string> = {
  NN: "sans salarié",
  "00": "sans salarié",
  "01": "1 ou 2 salariés",
  "02": "3 à 5 salariés",
  "03": "6 à 9 salariés",
  "11": "10 à 19 salariés",
  "12": "20 à 49 salariés",
  "21": "50 à 99 salariés",
  "22": "100 à 199 salariés",
  "31": "200 à 249 salariés",
  "32": "250 à 499 salariés",
  "41": "500 à 999 salariés",
  "42": "1 000 à 1 999 salariés",
  "51": "2 000 à 4 999 salariés",
  "52": "5 000 à 9 999 salariés",
  "53": "10 000 salariés et plus",
};

export function headcountLabel(code: string | null | undefined): string | null {
  return code ? (HEADCOUNT_LABELS[code] ?? null) : null;
}

export function nafLabel(code: string | null | undefined): string | null {
  return code ? (NAF_LABELS[code] ?? null) : null;
}
