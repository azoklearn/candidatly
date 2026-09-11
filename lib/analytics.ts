/**
 * Page addresses sent to Vercel Web Analytics (docs/QUESTIONS.md C84) keep only the path:
 * query strings (sign-in tokens, typed filters) and fragments are dropped, and identifiers
 * in the path become "[id]", so no visit can be tied to an application or a student.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Custom events (docs/QUESTIONS.md C85), named in French for the owner's dashboard. At most
 * two properties each (the Vercel Pro limit), never a personal detail.
 */
export const EVENTS = {
  signup: "Inscription",
  onboardingDone: "Questionnaire terminé",
  planChosen: "Forfait choisi",
  checkoutStarted: "Paiement démarré",
  subscriptionActivated: "Abonnement activé",
  subscriptionEnded: "Abonnement terminé",
  offersRefreshed: "Offres actualisées",
  applicationPrepared: "Candidature préparée",
  applicationSent: "Candidature envoyée",
  spontaneousApplication: "Candidature spontanée",
  offerSiteOpened: "Site de l’offre ouvert",
  signupClicked: "Clic inscription",
} as const;
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
export type EventProperties = Record<string, string | number | boolean | null>;

export function anonymizeUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value.split(/[?#]/)[0] ?? "";
  }
  const path = url.pathname
    .split("/")
    .map((segment) => (UUID.test(segment) ? "[id]" : segment))
    .join("/");
  return `${url.origin}${path}`;
}
