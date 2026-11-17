/**
 * Plans shown on /tarifs and after the questionnaire (docs/QUESTIONS.md C82, C113): three
 * durations, each with its own features. "1 mois" and "3 mois" renew by themselves and can
 * be stopped from the account; "À vie" is paid once. Prices in euro cents. Features that
 * are not built yet are flagged `soon` and shown as such: nothing is sold before it exists.
 * The ids stay "basic", "plus" and "premium": the access rules and the stored choices keep
 * their meaning. The wording says "tu": the plans belong to the entry funnel (C93).
 */

export const PLAN_IDS = ["basic", "plus", "premium"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
/**
 * Every billing that can be stored. "annual" only belongs to the memberships sold on Whop
 * before C113; new plans use the first three.
 */
export const BILLINGS = ["monthly", "quarterly", "lifetime", "annual"] as const;
export type Billing = (typeof BILLINGS)[number];

export type PlanFeature = { label: string; soon?: boolean };
export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** How this plan is charged: every month, every three months, or once. */
  billing: Billing;
  priceCents: number;
  features: PlanFeature[];
};

const DAYS_PER_MONTH = 30;

export const PLANS: readonly Plan[] = [
  {
    id: "basic",
    name: "1 mois",
    tagline: "Pour tester et trouver les bonnes offres",
    billing: "monthly",
    priceCents: 1990,
    features: [
      { label: "Les offres d’alternance de ta zone et de ton domaine" },
      { label: "Un score de correspondance pour chaque offre" },
      { label: "Les entreprises qui recrutent près de chez toi" },
      { label: "3 recherches par jour" },
      { label: "Sans engagement, tu arrêtes quand tu veux" },
    ],
  },
  {
    id: "plus",
    name: "3 mois",
    tagline: "Le temps d’une vraie recherche, sans y passer tes soirées",
    billing: "quarterly",
    priceCents: 2990,
    features: [
      { label: "Tout le forfait 1 mois" },
      { label: "Ta lettre de motivation adaptée à chaque entreprise" },
      { label: "Ta candidature prête avec ton CV, et le suivi des réponses" },
      { label: "10 recherches par jour" },
      { label: "Ton CV adapté à chaque entreprise", soon: true },
      { label: "L’envoi direct de tes candidatures", soon: true },
    ],
  },
  {
    id: "premium",
    name: "À vie",
    tagline: "Un seul paiement, pour toutes tes recherches",
    billing: "lifetime",
    priceCents: 12000,
    features: [
      { label: "Tout le forfait 3 mois" },
      { label: "Recherches illimitées" },
      { label: "Un seul paiement, aucun abonnement" },
      { label: "Les nouvelles fonctions incluses dès leur sortie" },
      { label: "L’optimisation de ton CV", soon: true },
    ],
  },
];

/** Monthly prices of the memberships sold on Whop before C113, for the admin revenue. */
export const LEGACY_MONTHLY_CENTS: Record<PlanId, number> = {
  basic: 999,
  plus: 1499,
  premium: 1999,
};
export const LEGACY_ANNUAL_MONTHS_CHARGED = 10;

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatEuros(cents: number): string {
  return euros.format(cents / 100);
}

export function findPlan(id: string | null | undefined): Plan | undefined {
  return PLANS.find((plan) => plan.id === id);
}

/** Months covered by one payment; null for a plan paid once. */
export function billingMonths(billing: Billing): number | null {
  if (billing === "monthly") return 1;
  if (billing === "quarterly") return 3;
  if (billing === "annual") return 12;
  return null;
}

/** What three months cost when paid month by month, against the 3 months plan. */
export function savingsCents(plan: Plan): number {
  const months = billingMonths(plan.billing);
  const monthly = findPlan("basic")?.priceCents ?? 0;
  if (months === null || months <= 1) return 0;
  return Math.max(0, monthly * months - plan.priceCents);
}

export type PriceView = {
  /** Price shown in large type: what is charged. */
  mainCents: number;
  /** "/mois", "/3 mois", or "une fois". */
  unit: string;
  /** "soit 9,97 € par mois", or null. */
  perMonthLabel: string | null;
  /** "soit 0,66 € par jour", or null for the plan paid once. */
  perDayLabel: string | null;
  /** How it is charged, in small print. */
  billedLabel: string;
  /** What it saves against the monthly plan, or null. */
  savingLabel: string | null;
};

export function priceView(plan: Plan): PriceView {
  const months = billingMonths(plan.billing);
  if (months === null) {
    return {
      mainCents: plan.priceCents,
      unit: "une fois",
      perMonthLabel: null,
      perDayLabel: null,
      billedLabel: "un seul paiement, accès pour toujours",
      savingLabel: "Pas d’abonnement, plus jamais rien à payer",
    };
  }
  const saving = savingsCents(plan);
  return {
    mainCents: plan.priceCents,
    unit: months === 1 ? "/mois" : `/${months} mois`,
    perMonthLabel:
      months === 1 ? null : `soit ${formatEuros(Math.round(plan.priceCents / months))} par mois`,
    perDayLabel: `soit ${formatEuros(Math.round(plan.priceCents / (months * DAYS_PER_MONTH)))} par jour`,
    billedLabel:
      months === 1
        ? "renouvelé chaque mois, sans engagement"
        : `renouvelé tous les ${months} mois, sans engagement`,
    savingLabel: saving > 0 ? `${formatEuros(saving)} de moins que ${months} mois au mois` : null,
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
