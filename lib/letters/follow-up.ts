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
}): string {
  const title = cleanOfferTitle(input.title) || input.title;
  const date = formatDate(input.sentAt);
  const where = input.companyName ? ` chez ${input.companyName}` : "";
  const opening = date
    ? `Le ${date}, je vous ai adressé ma candidature en alternance pour le poste de ${title}${where}.`
    : `Je vous ai récemment adressé ma candidature en alternance pour le poste de ${title}${where}.`;
  return [
    `Objet : Relance de ma candidature au poste de ${title}`,
    "",
    "Madame, Monsieur,",
    "",
    `${opening} Ce poste m'intéresse toujours et je me permets de revenir vers vous pour savoir si ma candidature a pu être étudiée.`,
    "",
    "Je reste disponible pour un entretien à votre convenance et vous remercie par avance de votre retour.",
    "",
    "Bien cordialement,",
    input.studentName ?? "",
  ]
    .join("\n")
    .trimEnd();
}
