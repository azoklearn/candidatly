import { describe, expect, it } from "vitest";

import { adaptLetter, cleanOfferTitle, cvSkillItems, sharedSkills } from "@/lib/letters/adapt";

const BASE = `Objet : Candidature pour une alternance

Madame, Monsieur,

Étudiante en troisième année de BUT Informatique à l'IUT Lyon 1, je souhaite rejoindre [entreprise] pour le poste de [poste]. Mes projets en TypeScript, React et SQL m'ont appris à livrer des applications utiles et testées. Je travaille avec rigueur et j'aime apprendre de nouveaux outils.

Au cours de ma formation, j'ai mené plusieurs projets en équipe, dont une application de gestion de bibliothèque et un site vitrine pour une association sportive. Ces expériences m'ont appris à organiser mon travail, à documenter mon code et à présenter mes choix techniques de façon claire.

En dehors des cours, je contribue à un projet open source de cartographie et je participe chaque année à un hackathon organisé par mon IUT. J'y ai appris à travailler vite, à écouter les besoins des utilisateurs et à accepter les retours pour améliorer mon travail.

Rejoindre votre entreprise me permettrait de progresser auprès d'une équipe expérimentée, tout en apportant mon énergie et mon sérieux au quotidien. Je serais heureuse d'échanger avec vous lors d'un entretien.

Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

Camille Testeur`;

const OFFER = {
  title: "Développeur Full-Stack (H/F) - Paris",
  companyName: "HOLIS",
  city: "Paris",
  skills: ["Maitrise de React", "Maitrise de PostgreSQL", "Bonne capacité de communication"],
  description: null,
};
const CV = "Camille Testeur. Compétences : TypeScript, React, SQL, Git.";

describe("cleanOfferTitle", () => {
  it("drops gender markers, suffixes and trailing parentheses", () => {
    expect(cleanOfferTitle("Développeur Full-Stack (H/F) - Paris")).toBe("Développeur Full-Stack");
    expect(cleanOfferTitle("Tech Lead C# React (H/F) (Link Consulting)")).toBe(
      "Tech Lead C# React",
    );
    expect(cleanOfferTitle("Alternance Développeur Fullstack - Montreuil (F/H)")).toBe(
      "Alternance Développeur Fullstack",
    );
  });
});

describe("sharedSkills", () => {
  it("keeps skills of the offer that the CV lists, in the offer's spelling", () => {
    expect(sharedSkills(OFFER.skills, CV)).toEqual(["React"]);
    expect(sharedSkills(["Anglais courant"], "Langues : anglais")).toEqual(["Anglais"]);
    expect(sharedSkills(["Bonne capacité de communication"], "communication")).toEqual([
      "communication",
    ]);
  });
});

describe("adaptLetter", () => {
  const result = adaptLetter({ baseLetter: BASE, offer: OFFER, cvText: CV });

  it("fills the subject, the placeholders and the skills sentence without inventing", () => {
    expect(result.letter).toContain(
      "Objet : Candidature en alternance au poste de Développeur Full-Stack",
    );
    expect(result.letter).toContain("rejoindre HOLIS pour le poste de Développeur Full-Stack.");
    expect(result.letter).toContain(
      "Votre offre cite React, une compétence qui figure dans mon CV.",
    );
    expect(result.letter).toContain("Rejoindre votre entreprise");
    expect(result.letter).not.toContain("[");
  });

  it("only changes passages of the base letter and stays within 90 to 110 % of its length", () => {
    for (const change of result.changes) expect(BASE).toContain(change.original);
    expect(result.letter.length).toBeGreaterThanOrEqual(BASE.length * 0.9);
    expect(result.letter.length).toBeLessThanOrEqual(BASE.length * 1.1);
    expect(result.confidence).toBe(1);
    expect(result.missing_info).toEqual([]);
  });

  it("names the company instead of a generic phrase when there is no placeholder", () => {
    const plain = BASE.replace(
      "[entreprise] pour le poste de [poste]",
      "une équipe de développement",
    );
    const adapted = adaptLetter({ baseLetter: plain, offer: OFFER, cvText: CV });
    expect(adapted.letter).toContain("Rejoindre HOLIS me permettrait");
  });

  it("explains what is missing rather than guessing", () => {
    const adapted = adaptLetter({
      baseLetter:
        "Madame, Monsieur,\n\nJe souhaite rejoindre [équipe]. Je suis motivée par l'alternance et par les projets concrets que je pourrai mener.",
      offer: { ...OFFER, companyName: null, skills: [] },
      cvText: CV,
    });
    expect(adapted.letter).toContain("[équipe]");
    expect(adapted.missing_info).toEqual([
      "Passage à compléter dans votre lettre : [équipe]",
      "L'offre ne précise pas le nom de l'employeur.",
      "Aucune compétence de votre CV n'est citée dans l'offre : ajoutez une phrase personnelle sur les missions.",
      "Votre lettre de base ne contient ni [entreprise] ni [poste] : ajoutez ces repères pour que l'adaptation se fasse automatiquement.",
    ]);
    expect(adapted.confidence).toBe(0.4);
  });
});

describe("skills found in the offer's text", () => {
  it("reads the CV's skill lines and finds them in the description when the offer has no skill list", () => {
    const cv = "Compétences : TypeScript, React, PostgreSQL, Git, Node.js";
    expect(cvSkillItems(cv)).toEqual(["TypeScript", "React", "PostgreSQL", "Git", "Node.js"]);
    const description =
      "Back end : maîtrise de PostgreSQL, Heroku et Git/Github. Front end : React et Redux.";
    expect(sharedSkills([], cv, 3, description)).toEqual(["React", "PostgreSQL", "Git"]);
    expect(sharedSkills([], cv, 3, "Poste en comptabilité")).toEqual([]);
  });
});
