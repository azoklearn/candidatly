/**
 * Sentence shown after the questionnaire, before the plans (docs/QUESTIONS.md C82). It says
 * "tu", like the questionnaire it follows (C93).
 *
 * No count reaches this screen (owner, 7 November 2026, C104): the student reads how their
 * search went, not how many offers they are about to buy. The figures still decide which
 * sentence is true, and the real numbers appear once the plan is active.
 */

export type SearchSummary = {
  before: string;
  /** Part of the sentence set in the accent style. */
  highlight: string;
  after: string;
  extra: string | null;
};

export function searchSummary(offers: number, companies: number): SearchSummary {
  if (offers > 0) {
    return {
      before: "On a trouvé ",
      highlight: offers > 1 ? "plusieurs offres" : "une offre",
      after: offers > 1 ? " qui collent à ton profil" : " qui colle à ton profil",
      extra:
        companies > 0 ? "Et des entreprises qui recrutent des alternants près de chez toi." : null,
    };
  }
  if (companies > 0) {
    return {
      before: "On a trouvé ",
      highlight: companies > 1 ? "des entreprises" : "une entreprise",
      after: ` qui ${companies > 1 ? "recrutent" : "recrute"} des alternants près de chez toi`,
      extra: null,
    };
  }
  return {
    before: "Ta recherche est ",
    highlight: "lancée",
    after: "",
    extra: "De nouvelles offres sont publiées chaque jour.",
  };
}
