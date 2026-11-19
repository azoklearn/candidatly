/**
 * The questions that shape the student's plan, and the plan itself (docs/QUESTIONS.md
 * C118). Four answers, one click each: where they stand, when they want to start, how much
 * they apply, what blocks them most. Everything here is pure, and nothing in the plan is a
 * statistic: the dates come from the calendar, the rest is advice worded as advice.
 */

export const SITUATIONS = [
  {
    value: "has_school",
    icon: "🎓",
    label: "J’ai ma formation, il me manque l’entreprise",
  },
  { value: "seeking_school", icon: "🔎", label: "Je cherche encore ma formation" },
  { value: "started", icon: "⏳", label: "Ma formation a commencé, toujours rien" },
  { value: "exploring", icon: "👀", label: "Je me renseigne pour l’instant" },
] as const;
export type Situation = (typeof SITUATIONS)[number]["value"];
export const SITUATION_VALUES = SITUATIONS.map((item) => item.value) as [Situation, ...Situation[]];

export const RHYTHMS = [
  { value: "low", icon: "0-2", label: "0 à 2", hint: "De temps en temps" },
  { value: "medium", icon: "3-9", label: "3 à 9", hint: "Quelques-unes chaque semaine" },
  { value: "high", icon: "10+", label: "10 ou plus", hint: "Je postule à fond" },
] as const;
export type Rhythm = (typeof RHYTHMS)[number]["value"];
export const RHYTHM_VALUES = RHYTHMS.map((item) => item.value) as [Rhythm, ...Rhythm[]];

export const BLOCKERS = [
  { value: "offers", icon: "🧭", label: "Je ne trouve pas d’offres qui me correspondent" },
  { value: "answers", icon: "📭", label: "On ne me répond pas" },
  { value: "time", icon: "⏱️", label: "Postuler me prend trop de temps" },
  { value: "companies", icon: "🏢", label: "Je ne sais pas à quelles entreprises écrire" },
] as const;
export type Blocker = (typeof BLOCKERS)[number]["value"];
export const BLOCKER_VALUES = BLOCKERS.map((item) => item.value) as [Blocker, ...Blocker[]];

/** "asap", "unknown", or a month written "2027-09". */
export const START_TIMING_PATTERN = /^(asap|unknown|\d{4}-(0[1-9]|1[0-2]))$/;

const MONTH_LABEL = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const MONTH_LONG = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const monthValue = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, "0")}`;

/** The twelve months a student can pick, starting with the current one. */
export function startMonths(now: Date = new Date()): { value: string; label: string }[] {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + index, 1));
    return {
      value: monthValue(date.getUTCFullYear(), date.getUTCMonth()),
      label: MONTH_LABEL.format(date),
    };
  });
}

/** A month accepted as an answer: one of the twelve shown, nothing older or further. */
export function isOfferedStart(value: string, now: Date = new Date()): boolean {
  if (value === "asap" || value === "unknown") return true;
  return startMonths(now).some((month) => month.value === value);
}

function monthStart(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

/** "septembre 2027" for a month answer, null for the two others. */
export function startLabel(value: string | null | undefined): string | null {
  const date = value ? monthStart(value) : null;
  return date ? MONTH_LONG.format(date) : null;
}

/** Whole weeks between now and the first day of the chosen month, never negative. */
export function weeksUntil(value: string, now: Date = new Date()): number | null {
  const date = monthStart(value);
  if (!date) return null;
  return Math.max(0, Math.floor((date.getTime() - now.getTime()) / (7 * 86_400_000)));
}

export type PlanLine = { title: string; body: string };
export type Plan = { goal: PlanLine; rhythm: PlanLine; first: PlanLine };

export type PlanAnswers = {
  situation: string | null;
  startTiming: string | null;
  rhythm: string | null;
  blocker: string | null;
  /** Internships and student jobs lead to companies, not offers (C106). */
  companiesOnly: boolean;
};

/**
 * The plan shown with the result of the search. Null until the four answers exist, so an
 * account created before C118 never sees a plan built on nothing.
 */
export function buildPlan(answers: PlanAnswers, now: Date = new Date()): Plan | null {
  const { startTiming, rhythm, blocker, companiesOnly } = answers;
  if (!answers.situation || !startTiming || !rhythm || !blocker) return null;
  const what = companiesOnly ? "une entreprise" : "un contrat";

  const month = startLabel(startTiming);
  const weeks = month ? weeksUntil(startTiming, now) : null;
  const goal: PlanLine = month
    ? {
        title: `Trouver ${what} avant ${month}`,
        body:
          weeks === null || weeks === 0
            ? "C’est maintenant : on va droit à l’essentiel."
            : weeks === 1
              ? "Il te reste 1 semaine : on va droit à l’essentiel."
              : `Il te reste ${weeks} semaines pour y arriver.`,
      }
    : startTiming === "asap"
      ? {
          title: `Trouver ${what} le plus vite possible`,
          body: "Chaque semaine compte : on va droit à l’essentiel.",
        }
      : {
          title: `Trouver ${what}, à ton rythme`,
          body: "Tu fixeras une date quand tu y verras plus clair.",
        };

  const contact = companiesOnly ? "entreprises contactées" : "candidatures";
  const rhythmLine: PlanLine =
    rhythm === "high"
      ? {
          title: "Garde ton rythme",
          body: `Tu en fais déjà beaucoup. On te fait gagner du temps sur chacune de tes ${contact}.`,
        }
      : rhythm === "medium"
        ? {
            title: `Vise 10 ${contact} par semaine`,
            body: "Tu as déjà l’habitude : on t’aide à en faire plus sans y passer plus de temps.",
          }
        : {
            title: `Commence par 5 ${contact} par semaine`,
            body: "Un rythme tenable, une par jour de semaine. Tu augmenteras ensuite.",
          };

  const first: PlanLine = companiesOnly
    ? {
        title: "On commence par tes entreprises",
        body: "Celles de ton domaine près de chez toi, les plus proches d’abord, avec leur fiche et leur téléphone quand on le connaît.",
      }
    : blocker === "answers"
      ? {
          title: "On commence par ta lettre",
          body: "Adaptée à chaque entreprise sans rien inventer, puis une relance conseillée 5 jours après l’envoi.",
        }
      : blocker === "time"
        ? {
            title: "On commence par te faire gagner du temps",
            body: "Les offres déjà triées, ta lettre prête pour chacune : tu relis, tu envoies.",
          }
        : blocker === "companies"
          ? {
              title: "On commence par les entreprises qui recrutent",
              body: "Celles qui embauchent des alternants près de chez toi, avec leur téléphone quand on le connaît.",
            }
          : {
              title: "On commence par tes offres",
              body: "Celles qui collent à ton métier, ton niveau et ta ville, avec un score sur chacune.",
            };

  return { goal, rhythm: rhythmLine, first };
}

const labelOf = (list: readonly { value: string; label: string }[], value: string | null) =>
  list.find((item) => item.value === value)?.label ?? null;

/** The four answers in words, for the admin pages. */
export function planAnswerLabels(answers: Omit<PlanAnswers, "companiesOnly">) {
  return {
    situation: labelOf(SITUATIONS, answers.situation),
    start:
      startLabel(answers.startTiming) ??
      (answers.startTiming === "asap"
        ? "Dès que possible"
        : answers.startTiming === "unknown"
          ? "Ne sait pas encore"
          : null),
    rhythm: labelOf(
      RHYTHMS.map((item) => ({ value: item.value, label: `${item.label} par semaine` })),
      answers.rhythm,
    ),
    blocker: labelOf(BLOCKERS, answers.blocker),
  };
}
