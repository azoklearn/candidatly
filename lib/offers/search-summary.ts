/** Sentence shown after the questionnaire, before the plans (docs/QUESTIONS.md C82). */

export type SearchSummary = {
  before: string;
  /** Part of the sentence set in the accent style. */
  highlight: string;
  after: string;
  extra: string | null;
};

const formatCount = (value: number) => new Intl.NumberFormat("fr-FR").format(value);
const counted = (count: number, one: string, many: string) =>
  `${formatCount(count)} ${count > 1 ? many : one}`;

function companiesPhrase(companies: number): string {
  return ` qui ${companies > 1 ? "recrutent" : "recrute"} des alternants près de chez vous`;
}

export function searchSummary(offers: number, companies: number): SearchSummary {
  if (offers > 0) {
    return {
      before: "Nous avons trouvé ",
      highlight: counted(offers, "offre", "offres"),
      after: offers > 1 ? " qui correspondent à votre profil" : " qui correspond à votre profil",
      extra:
        companies > 0
          ? `Et ${counted(companies, "entreprise", "entreprises")}${companiesPhrase(companies)}.`
          : null,
    };
  }
  if (companies > 0) {
    return {
      before: "Nous avons trouvé ",
      highlight: counted(companies, "entreprise", "entreprises"),
      after: companiesPhrase(companies),
      extra: null,
    };
  }
  return {
    before: "Votre recherche est ",
    highlight: "lancée",
    after: "",
    extra: "De nouvelles offres sont publiées chaque jour.",
  };
}
