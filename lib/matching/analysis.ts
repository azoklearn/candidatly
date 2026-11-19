import { tokenize } from "@/lib/text/french";

import type { StoredScoreReasons } from "./reasons";

/**
 * What fits and what is missing between a profile and an offer (docs/QUESTIONS.md C120),
 * with one concrete piece of advice per gap. Built by rules from the reasons of the score
 * and from the offer itself: nothing is generated, nothing is guessed about the student.
 * The wording says "vous", like the offer screens it is shown on.
 */

export type MatchPoint = {
  /** A few words, for a chip on a card. */
  short: string;
  /** The full sentence, for the offer page. */
  text: string;
};

export type MatchAnalysis = { fits: MatchPoint[]; gaps: MatchPoint[]; tips: string[] };

export type AnalysisInput = {
  reasons: StoredScoreReasons;
  /** The student's search radius, to tell a short trip from the edge of the zone. */
  radiusKm: number | null;
  /** European levels 3 to 7: the one the student prepares, the one the offer targets. */
  profileLevel: number | null;
  offerLevel: number | null;
  /** Skills the offer asks for, as written by the recruiter. */
  desiredSkills: string[];
  /** Whether the account holds a CV: without one the score ignores skills. */
  hasCv: boolean;
  /** Text read from that CV, when the caller loaded it: needed to spot missing skills. */
  cvText: string | null;
  /** A school, a training body or an agency published the offer (lib/offers/noise.ts). */
  noiseKind: string | null;
};

const km = (value: number) => (value < 1 ? "moins d’1 km" : `${Math.round(value)} km`);
const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

const FRESH_DAYS = 7;
const OLD_DAYS = 30;
const NEAR_KM = 10;
const MAX_MISSING_SKILLS = 4;

/** Skills asked by the offer of which no meaningful word appears in the CV. */
export function missingSkills(desiredSkills: string[], cvText: string | null): string[] {
  if (!cvText) return [];
  const cvWords = new Set(tokenize(cvText, 3));
  return desiredSkills
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0 && skill.length <= 90)
    .filter((skill) => {
      const words = tokenize(skill, 4);
      return words.length > 0 && !words.some((word) => cvWords.has(word));
    })
    .slice(0, MAX_MISSING_SKILLS);
}

export function analyseMatch(input: AnalysisInput): MatchAnalysis {
  const { reasons } = input;
  const fits: MatchPoint[] = [];
  const gaps: MatchPoint[] = [];
  const tips: string[] = [];

  if (reasons.rome === "exact") {
    fits.push({ short: "Votre métier", text: "Le métier est l’un de ceux que vous visez." });
  } else if (reasons.rome === "related") {
    gaps.push({
      short: "Métier proche",
      text: "Le métier est proche de ceux que vous visez, sans être le même.",
    });
    tips.push(
      "Dans votre lettre, reliez ce que vous avez déjà fait aux missions de ce poste précis.",
    );
  }

  const distance = reasons.distanceKm;
  const edge = input.radiusKm !== null && distance > input.radiusKm * 0.75;
  if (distance <= NEAR_KM && !edge) {
    fits.push({ short: `À ${km(distance)}`, text: `Le poste est à ${km(distance)} de chez vous.` });
  } else if (edge) {
    gaps.push({
      short: `À ${km(distance)}`,
      text: `Le poste est à ${km(distance)} : c’est le bord de votre zone de recherche.`,
    });
    tips.push("Vérifiez le temps de trajet réel avant de candidater.");
  } else {
    fits.push({
      short: `À ${km(distance)}`,
      text: `Le poste est à ${km(distance)}, dans votre zone de recherche.`,
    });
  }

  if (reasons.diploma === "exact") {
    fits.push({
      short: "Votre niveau",
      text: "Le niveau visé par l’offre est celui que vous préparez.",
    });
  } else if (reasons.diploma === "adjacent" || reasons.diploma === "mismatch") {
    const above =
      input.profileLevel !== null && input.offerLevel !== null
        ? input.offerLevel > input.profileLevel
        : null;
    const far = reasons.diploma === "mismatch";
    gaps.push({
      short: above === null ? "Niveau différent" : above ? "Niveau au-dessus" : "Niveau en dessous",
      text:
        above === null
          ? "Le niveau visé par l’offre n’est pas celui que vous préparez."
          : above
            ? `L’offre vise un niveau ${far ? "nettement " : ""}au-dessus de celui que vous préparez.`
            : `L’offre vise un niveau ${far ? "nettement " : ""}en dessous de celui que vous préparez.`,
    });
    tips.push(
      above === false
        ? "Vérifiez que le diplôme préparé par ce contrat vous intéresse vraiment."
        : "Vérifiez les conditions d’accès de l’offre avant d’y passer du temps.",
    );
  } else {
    gaps.push({
      short: "Niveau non précisé",
      text: "L’offre ne dit pas quel niveau de diplôme elle vise.",
    });
    tips.push("Posez la question du niveau attendu dès votre premier échange.");
  }

  const days = reasons.freshnessDays;
  if (days !== null && days <= FRESH_DAYS) {
    fits.push({
      short: "Récente",
      text:
        days === 0
          ? "L’offre a été publiée aujourd’hui."
          : `L’offre a été publiée il y a ${days} ${plural(days, "jour", "jours")}.`,
    });
  } else if (days !== null && days > OLD_DAYS) {
    gaps.push({
      short: "Ancienne",
      text: `L’offre a été publiée il y a ${days} jours : le poste est peut-être déjà pourvu.`,
    });
    tips.push("Appelez ou écrivez vite pour vérifier que l’offre est toujours ouverte.");
  }

  if (!input.hasCv) {
    gaps.push({
      short: "Pas de CV",
      text: "Votre compte n’a pas de CV : le score ne tient pas compte de vos compétences.",
    });
    tips.push("Ajoutez votre CV depuis votre compte pour un score plus juste.");
  } else {
    const found = reasons.keywords;
    if (found.length >= 3) {
      fits.push({
        short: `${found.length} mots de votre CV`,
        text: `${found.length} mots de votre CV se retrouvent dans l’annonce : ${found.join(", ")}.`,
      });
    } else if (found.length > 0) {
      gaps.push({
        short: "Peu de mots en commun",
        text: `Seulement ${found.length} ${plural(found.length, "mot", "mots")} de votre CV se ${plural(found.length, "retrouve", "retrouvent")} dans l’annonce : ${found.join(", ")}.`,
      });
    } else {
      gaps.push({
        short: "Aucun mot en commun",
        text: "Aucun mot-clé de votre CV ne se retrouve dans l’annonce.",
      });
    }
    const missing = missingSkills(input.desiredSkills, input.cvText);
    if (missing.length > 0) {
      gaps.push({
        short: `${missing.length} ${plural(missing.length, "compétence absente", "compétences absentes")}`,
        text: `Compétences demandées qu’on ne retrouve pas dans votre CV : ${missing.join(" ; ")}.`,
      });
      tips.push(
        "Si vous avez ces compétences, écrivez-les dans votre CV avec les mots de l’annonce. Sinon, ne les inventez pas : dites ce que vous voulez apprendre.",
      );
    } else if (found.length < 3) {
      tips.push(
        "Reprenez dans votre lettre les mots de l’annonce qui décrivent vraiment votre expérience.",
      );
    }
  }

  if (input.noiseKind === "school") {
    gaps.push({
      short: "Gérée par une école",
      text: "L’offre est gérée par une école : c’est elle qui vous répondra, pas l’employeur.",
    });
    tips.push("Demandez à l’école si le contrat impose de s’inscrire chez elle.");
  } else if (input.noiseKind === "training") {
    gaps.push({
      short: "Organisme de formation",
      text: "L’annonce vient d’un organisme de formation, pas d’une entreprise qui recrute pour elle-même.",
    });
    tips.push("Vérifiez qu’un employeur est bien identifié avant de vous engager.");
  } else if (input.noiseKind === "staffing") {
    gaps.push({
      short: "Agence",
      text: "L’annonce vient d’une agence d’intérim ou de recrutement.",
    });
    tips.push("Demandez le nom de l’entreprise où vous travaillerez.");
  }

  return { fits, gaps, tips: [...new Set(tips)] };
}
