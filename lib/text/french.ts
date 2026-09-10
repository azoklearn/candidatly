import { normalizeSearchText } from "@/lib/rome/parse";

/** Normalised French stop words (no accents), for keyword extraction and search terms. */
export const FRENCH_STOPWORDS = new Set(
  `a au aux avec ce ces cet cette dans de des du elle en et eux il ils je la le les leur leurs lui ma mais me meme mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous y ete etre avoir fait faire suis sont est etais etait sera plus moins tres bien aussi ainsi comme donc car si sans sous chez entre vers depuis pendant apres avant tout tous toute toutes autre autres cela ceci ca dont lors afin chaque plusieurs notamment etc ans annee annees mois jour jours madame monsieur`.split(
    /\s+/,
  ),
);

/** Lower-case, accent-free words of at least minLength characters, without stop words. */
export function tokenize(text: string, minLength = 3): string[] {
  return normalizeSearchText(text)
    .split(" ")
    .filter(
      (word) => word.length >= minLength && !FRENCH_STOPWORDS.has(word) && !/^\d+$/.test(word),
    );
}
