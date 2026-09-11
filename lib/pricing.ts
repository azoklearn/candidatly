/**
 * Plans shown on /tarifs and after the questionnaire (docs/QUESTIONS.md C82). Prices in
 * euro cents; annual billing charges 10 months (two months free). Features that are not
 * built yet are flagged `soon` and shown as such: nothing is sold before it exists.
 */

export const PLAN_IDS = ["basic", "plus", "premium"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export const BILLINGS = ["monthly", "annual"] as const;
export type Billing = (typeof BILLINGS)[number];

export type PlanFeature = { label: string; soon?: boolean };
export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyCents: number;
  features: PlanFeature[];
};

export const ANNUAL_MONTHS_CHARGED = 10;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

export const PLANS: readonly Plan[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "Pour trouver les bonnes offres",
    monthlyCents: 1499,
    features: [
      { label: "Les offres d’alternance de votre zone et de votre domaine" },
      { label: "Un score de correspondance pour chaque offre" },
      { label: "Les entreprises qui recrutent près de chez vous" },
      { label: "3 recherches par jour" },
    ],
  },
  {
    id: "plus",
    name: "Plus",
    tagline: "Pour candidater sans y passer vos soirées",
    monthlyCents: 2499,
    features: [
      { label: "Tout le forfait Basic" },
      { label: "Votre lettre de motivation adaptée à chaque entreprise" },
      { label: "Votre candidature prête avec votre CV, et le suivi des réponses" },
      { label: "Votre CV adapté à chaque entreprise", soon: true },
      { label: "L’envoi direct de vos candidatures", soon: true },
      { label: "10 recherches par jour" },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Pour mettre toutes les chances de votre côté",
    monthlyCents: 3999,
    features: [
      { label: "Tout le forfait Plus" },
      { label: "Recherches illimitées" },
      { label: "L’optimisation de votre CV", soon: true },
    ],
  },
];

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatEuros(cents: number): string {
  return euros.format(cents / 100);
}

export function annualCents(plan: Plan): number {
  return plan.monthlyCents * ANNUAL_MONTHS_CHARGED;
}

export type PriceView = {
  /** Price per month shown in large type. */
  mainCents: number;
  /** Monthly price struck through next to the annual price per month, null in monthly mode. */
  struckCents: number | null;
  perDayCents: number;
  /** "facturé 249,90 € par an" in annual mode. */
  billedLabel: string | null;
};

export function priceView(plan: Plan, billing: Billing): PriceView {
  if (billing === "monthly") {
    return {
      mainCents: plan.monthlyCents,
      struckCents: null,
      perDayCents: Math.round(plan.monthlyCents / DAYS_PER_MONTH),
      billedLabel: null,
    };
  }
  const yearly = annualCents(plan);
  return {
    mainCents: Math.round(yearly / 12),
    struckCents: plan.monthlyCents,
    perDayCents: Math.round(yearly / DAYS_PER_YEAR),
    billedLabel: `facturé ${formatEuros(yearly)} par an`,
  };
}

export type PlanCounts = Record<PlanId, number>;
export type FeaturedBadge = { planId: PlanId; label: string };

/** Below this many choices, no plan is called "le plus choisi". */
export const MOST_CHOSEN_MIN_CHOICES = 20;

/**
 * "Le plus choisi" only once it is true (same rule as the landing proof line, C73); until
 * then the second plan carries a "Recommandé" badge.
 */
export function featuredBadge(counts: PlanCounts | null): FeaturedBadge {
  if (counts) {
    const total = PLAN_IDS.reduce((sum, id) => sum + counts[id], 0);
    const [leader, runnerUp] = [...PLAN_IDS].sort((a, b) => counts[b] - counts[a]);
    if (
      leader &&
      runnerUp &&
      total >= MOST_CHOSEN_MIN_CHOICES &&
      counts[leader] > counts[runnerUp]
    ) {
      return { planId: leader, label: "Le plus choisi" };
    }
  }
  return { planId: "plus", label: "Recommandé" };
}
