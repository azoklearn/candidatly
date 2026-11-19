import { isFollowUpDue } from "@/lib/letters/follow-up";

/**
 * What the home of the paid area shows (docs/QUESTIONS.md C124): the student's own counts,
 * what deserves their attention first, and every feature with its state. Everything here is
 * pure and counts only the student's rows: no figure is estimated or rounded up.
 */

export type DashboardInput = {
  matches: { status: string; noise: boolean }[];
  applications: { status: string; nextFollowUpAt: string | null; preparedAtNight: boolean }[];
  hasCv: boolean;
  hasBaseLetter: boolean;
  /** The plan includes the tailored letter (3 mois and À vie). */
  letters: boolean;
  nightPrep: boolean;
  hideNoise: boolean;
  /** An internship or a student job: companies, no published offers (C106). */
  companiesOnly: boolean;
  /** Companies of the student's search with no published offer. */
  companies: number;
  now?: number;
};

export type DashboardCounts = {
  newOffers: number;
  savedOffers: number;
  toSend: number;
  waiting: number;
  replies: number;
  followUps: number;
  nightLetters: number;
};

export type DashboardTask = {
  id:
    "follow_up" | "night_letters" | "to_send" | "cv" | "base_letter" | "sort_offers" | "companies";
  title: string;
  body: string;
  href: string;
  cta: string;
};

const TO_SEND = new Set(["draft", "ready"]);
const WAITING = new Set(["sent", "viewed", "unknown"]);
const REPLIES = new Set(["replied_positive", "replied_negative"]);

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

export function countDashboard(input: DashboardInput): DashboardCounts {
  const now = input.now ?? Date.now();
  // Same rule as the list: a school or agency offer is hidden while it is still "new".
  const visible = input.matches.filter(
    (match) => !(input.hideNoise && match.noise && match.status === "new"),
  );
  return {
    newOffers: visible.filter((match) => match.status === "new").length,
    savedOffers: visible.filter((match) => match.status === "saved").length,
    toSend: input.applications.filter((item) => TO_SEND.has(item.status)).length,
    waiting: input.applications.filter((item) => WAITING.has(item.status)).length,
    replies: input.applications.filter((item) => REPLIES.has(item.status)).length,
    followUps: input.applications.filter((item) =>
      isFollowUpDue(item.status, item.nextFollowUpAt, now),
    ).length,
    nightLetters: input.applications.filter(
      (item) => item.preparedAtNight && item.status === "draft",
    ).length,
  };
}

/** What to do next, most pressing first. Empty when everything is up to date. */
export function buildTasks(input: DashboardInput, counts = countDashboard(input)): DashboardTask[] {
  const tasks: DashboardTask[] = [];
  if (counts.followUps > 0) {
    tasks.push({
      id: "follow_up",
      title: `${counts.followUps} ${plural(counts.followUps, "relance conseillée", "relances conseillées")}`,
      body: "Sans réponse depuis 5 jours : le message de relance est prêt, vous le copiez et vous l’envoyez.",
      href: "/applications",
      cta: "Relancer",
    });
  }
  if (counts.nightLetters > 0) {
    tasks.push({
      id: "night_letters",
      title: `${counts.nightLetters} ${plural(counts.nightLetters, "lettre préparée cette nuit", "lettres préparées cette nuit")}`,
      body: "Relisez, ajustez, puis envoyez vous-même : rien ne part sans vous.",
      href: "/applications",
      cta: "Relire",
    });
  }
  const others = counts.toSend - counts.nightLetters;
  if (others > 0) {
    tasks.push({
      id: "to_send",
      title: `${others} ${plural(others, "candidature à envoyer", "candidatures à envoyer")}`,
      body: "La lettre est prête ou presque : terminez-la et confirmez l’envoi pour lancer le suivi.",
      href: "/applications",
      cta: "Terminer",
    });
  }
  if (!input.hasCv) {
    tasks.push({
      id: "cv",
      title: "Ajoutez votre CV",
      body: "Il affine l’analyse de chaque offre et accompagne vos candidatures.",
      href: "/account",
      cta: "Ajouter",
    });
  }
  if (input.letters && !input.hasBaseLetter) {
    tasks.push({
      id: "base_letter",
      title: "Ajoutez votre lettre de base",
      body: "C’est elle qui est adaptée à chaque entreprise : sans elle, pas de lettre prête.",
      href: "/account",
      cta: "Ajouter",
    });
  }
  if (!input.companiesOnly && counts.newOffers > 0) {
    tasks.push({
      id: "sort_offers",
      title: `${counts.newOffers} ${plural(counts.newOffers, "offre à découvrir", "offres à découvrir")}`,
      body: "Passez-les une par une : vous gardez celles qui vous plaisent, vous écartez les autres.",
      href: "/offers?mode=swipe",
      cta: "Trier",
    });
  }
  if (input.companiesOnly && input.companies > 0) {
    tasks.push({
      id: "companies",
      title: `${input.companies} ${plural(input.companies, "entreprise à contacter", "entreprises à contacter")}`,
      body: "Les entreprises de vos métiers près de chez vous, les plus proches d’abord.",
      href: "/offers",
      cta: "Voir",
    });
  }
  return tasks;
}

export type FeatureState = "included" | "on" | "off" | "locked" | "todo";

export type DashboardFeature = {
  id: string;
  icon: string;
  /** Pastel behind the icon. */
  tint: string;
  title: string;
  body: string;
  href: string | null;
  external?: boolean;
  state: FeatureState;
  stateLabel: string;
};

const LOCKED = "Forfaits 3 mois et À vie";

/** Every feature of the product, with what it is worth for this student today. */
export function buildFeatures(input: DashboardInput): DashboardFeature[] {
  const included = { state: "included" as const, stateLabel: "Inclus" };
  const locked = { state: "locked" as const, stateLabel: LOCKED, href: null };
  const offers: DashboardFeature[] = input.companiesOnly
    ? [
        {
          id: "companies",
          icon: "🏢",
          tint: "#ffd9c4",
          title: "Vos entreprises",
          body: "Les entreprises de vos métiers près de chez vous, avec leur fiche et leur téléphone.",
          href: "/offers",
          ...included,
        },
      ]
    : [
        {
          id: "offers",
          icon: "🎯",
          tint: "#ffd9c4",
          title: "Offres triées pour vous",
          body: "Les offres d’alternance de votre zone, avec un score de correspondance pour chacune.",
          href: "/offers",
          ...included,
        },
        {
          id: "swipe",
          icon: "👆",
          tint: "#ffe9a8",
          title: "Une par une",
          body: "Triez vos offres au pouce : à droite vous gardez, à gauche vous écartez.",
          href: "/offers?mode=swipe",
          ...included,
        },
        {
          id: "analysis",
          icon: "🔍",
          tint: "#d6e2ff",
          title: "Analyse du match",
          body: "Sur chaque offre : ce qui colle à votre profil, ce qui manque, et quoi mettre en avant.",
          href: "/offers",
          ...included,
        },
        {
          id: "noise",
          icon: "🧹",
          tint: "#d9f2e0",
          title: "Filtre anti-bruit",
          body: "Masque les offres d’écoles, d’organismes de formation et d’agences d’intérim.",
          href: "/offers",
          state: input.hideNoise ? "on" : "off",
          stateLabel: input.hideNoise ? "Activé" : "Désactivé",
        },
        {
          id: "companies",
          icon: "🏢",
          tint: "#e4d8ff",
          title: "Entreprises sans offre publiée",
          body: "Qui les dirige, comment les joindre. Être listée ne garantit pas qu’un poste est ouvert.",
          href: input.companies > 0 ? "#entreprises" : null,
          state: "included",
          stateLabel: input.companies > 0 ? "Inclus" : "Aucune pour l’instant",
        },
      ];

  return [
    ...offers,
    {
      id: "letter",
      icon: "✍️",
      tint: "#ffd0b4",
      title: "Lettre adaptée",
      body: "Votre lettre de base, ajustée à chaque entreprise sans rien inventer, modifiable avant l’envoi.",
      ...(input.letters ? { href: "/applications", ...included } : locked),
    },
    {
      id: "spontaneous",
      icon: "📮",
      tint: "#ffe9a8",
      title: "Candidature spontanée",
      body: "Une lettre adaptée à une entreprise de votre sélection, ajoutée à votre suivi.",
      ...(input.letters
        ? {
            ...included,
            // The companies sit lower on the dashboard, when the search holds some.
            href: input.companiesOnly ? "/offers" : input.companies > 0 ? "#entreprises" : null,
          }
        : locked),
    },
    {
      id: "night",
      icon: "🌙",
      tint: "#d6e2ff",
      title: "Préparation de nuit",
      body: "Chaque nuit, la lettre est préparée pour vos 3 meilleures nouvelles offres. Rien n’est envoyé.",
      ...(input.letters
        ? {
            href: "/applications",
            state: input.nightPrep ? ("on" as const) : ("off" as const),
            stateLabel: input.nightPrep ? "Activée" : "Désactivée",
          }
        : locked),
    },
    {
      id: "tracking",
      icon: "📬",
      tint: "#d9f2e0",
      title: "Suivi et relances",
      body: "Le statut de chaque candidature, et un message de relance prêt après 5 jours sans réponse.",
      href: "/applications",
      ...included,
    },
    {
      id: "salary",
      icon: "💶",
      tint: "#ffe9a8",
      title: "Simulateur de salaire",
      body: "Le minimum légal de votre contrat selon votre âge et votre année.",
      href: "/outils/salaire-alternance",
      ...included,
    },
    {
      id: "guides",
      icon: "📚",
      tint: "#e4d8ff",
      title: "Guides",
      body: "Trouver une alternance, écrire sa lettre, réussir une candidature spontanée.",
      href: "/guides",
      ...included,
    },
    {
      id: "documents",
      icon: "📄",
      tint: "#ffd9c4",
      title: "CV et lettre de base",
      body: "Vos documents, privés, remplaçables à tout moment.",
      href: "/account",
      state: input.hasCv && input.hasBaseLetter ? "included" : "todo",
      stateLabel:
        input.hasCv && input.hasBaseLetter
          ? "À jour"
          : !input.hasCv && !input.hasBaseLetter
            ? "À ajouter"
            : input.hasCv
              ? "Lettre à ajouter"
              : "CV à ajouter",
    },
    {
      id: "data",
      icon: "🔐",
      tint: "#d9f2e0",
      title: "Vos données",
      body: "Téléchargez tout ce que nous avons sur vous, ou supprimez votre compte pour de bon.",
      href: "/account",
      ...included,
    },
  ];
}
