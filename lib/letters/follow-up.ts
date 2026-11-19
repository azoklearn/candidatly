import { formatDate } from "@/lib/format";

import { cleanOfferTitle } from "./adapt";

/** Follow-up suggested 5 days after sending without an answer (brief section 5.5). */
export const FOLLOW_UP_DELAY_MS = 5 * 24 * 60 * 60 * 1000;

export function isFollowUpDue(
  status: string,
  nextFollowUpAt: string | null,
  now: number = Date.now(),
): boolean {
  return (
    (status === "sent" || status === "viewed") &&
    nextFollowUpAt !== null &&
    new Date(nextFollowUpAt).getTime() <= now
  );
}

/** Short, factual follow-up message the student copies and sends themselves. */
export function followUpMessage(input: {
  title: string;
  companyName: string | null;
  sentAt: string | null;
  studentName: string | null;
  /** An unsolicited application (C121): no offer, `title` may be empty. */
  spontaneous?: { contractWords: string };
}): string {
  const title = cleanOfferTitle(input.title) || input.title;
  const date = formatDate(input.sentAt);
  const where = input.companyName ? ` chez ${input.companyName}` : "";
  const what = input.spontaneous
    ? `une candidature spontanée ${input.spontaneous.contractWords}${title ? ` pour un poste de ${title}` : ""}${where}`
    : `ma candidature en alternance pour le poste de ${title}${where}`;
  const opening = date
    ? `Le ${date}, je vous ai adressé ${what}.`
    : `Je vous ai récemment adressé ${what}.`;
  const subject = input.spontaneous
    ? "Relance de ma candidature spontanée"
    : `Relance de ma candidature au poste de ${title}`;
  return [
    `Objet : ${subject}`,
    "",
    "Madame, Monsieur,",
    "",
    `${opening} ${input.spontaneous ? "Rejoindre votre équipe" : "Ce poste"} m'intéresse toujours et je me permets de revenir vers vous pour savoir si ma candidature a pu être étudiée.`,
    "",
    "Je reste disponible pour un entretien à votre convenance et vous remercie par avance de votre retour.",
    "",
    "Bien cordialement,",
    input.studentName ?? "",
  ]
    .join("\n")
    .trimEnd();
}
