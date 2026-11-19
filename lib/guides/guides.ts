/**
 * The public guides (docs/QUESTIONS.md C122). Plain advice in our own words: no statistic,
 * no promise of a result, and every legal point links to the official page that states it.
 * Each guide says "tu", like the rest of the public pages.
 */

export type GuideSection = {
  heading: string;
  paragraphs: string[];
  list?: string[];
};

export type Guide = {
  slug: string;
  title: string;
  description: string;
  /** One sentence under the title. */
  intro: string;
  sections: GuideSection[];
  /** Official pages the guide relies on. */
  sources?: { label: string; href: string }[];
  /** Where the guide sends the reader next. */
  next: { label: string; href: string };
};

export const GUIDES: readonly Guide[] = [
  {
    slug: "trouver-une-alternance",
    title: "Trouver une alternance : la méthode en 5 étapes",
    description:
      "Comment chercher une alternance sans y passer tes soirées : cibler, préparer ton CV, candidater tôt, penser aux entreprises sans offre, relancer.",
    intro:
      "Chercher une alternance, c’est surtout de l’organisation. Voici l’ordre dans lequel faire les choses.",
    sections: [
      {
        heading: "1. Dis précisément ce que tu cherches",
        paragraphs: [
          "Une recherche floue donne des offres floues. Avant d’ouvrir un seul site, écris trois choses : le métier que tu vises (deux ou trois intitulés proches suffisent), le niveau du diplôme que tu prépares, et la zone où tu peux vraiment te rendre chaque jour.",
          "Ces trois réponses servent à tout le reste : à filtrer les offres, à écrire ta lettre, à répondre en entretien quand on te demande pourquoi ce poste.",
        ],
      },
      {
        heading: "2. Prépare un CV qui se lit en dix secondes",
        paragraphs: [
          "Un recruteur parcourt ton CV avant de le lire. Mets en haut ce qu’il cherche : la formation que tu prépares, le rythme de ton alternance si tu le connais, et la date à laquelle tu peux commencer.",
        ],
        list: [
          "Une page, pas plus.",
          "Tes compétences avec les mots exacts du métier : les annonces utilisent ces mêmes mots.",
          "Tes projets et tes jobs, même petits : ils montrent que tu sais tenir un engagement.",
          "Rien d’inventé. Une compétence que tu ne sais pas défendre en entretien te dessert.",
        ],
      },
      {
        heading: "3. Candidate tôt, puis régulièrement",
        paragraphs: [
          "Une offre peut être retirée dès que le poste est pourvu : mieux vaut la voir tôt. Regarde les nouvelles offres plusieurs fois par semaine plutôt qu’une grande session par mois.",
          "Fixe-toi un rythme que tu peux tenir : quelques candidatures soignées chaque semaine valent mieux que cinquante envois identiques en un week-end.",
        ],
      },
      {
        heading: "4. Écris aussi aux entreprises qui n’ont rien publié",
        paragraphs: [
          "Des entreprises prennent un alternant sans publier d’annonce. Une candidature spontanée, courte et adressée à la bonne entreprise, peut tomber au bon moment.",
          "Vise des entreprises de ton domaine, près de chez toi, et dis en une phrase pourquoi tu leur écris à elles.",
        ],
      },
      {
        heading: "5. Relance et note tout",
        paragraphs: [
          "Sans réponse au bout de quelques jours, une relance courte et polie est normale. Note pour chaque candidature la date d’envoi, le contact et la réponse : au bout de vingt candidatures, la mémoire ne suffit plus.",
        ],
      },
      {
        heading: "Ce que JobGPT fait dans cette méthode",
        paragraphs: [
          "JobGPT lit ton CV, garde les offres d’alternance qui collent à ton métier, ton niveau et ta zone, donne un score à chacune, adapte ta lettre à l’entreprise sans rien inventer, et te rappelle quand relancer. Tu restes celui ou celle qui envoie.",
        ],
      },
    ],
    next: { label: "Lancer ma recherche", href: "/onboarding/1" },
  },
  {
    slug: "lettre-de-motivation-alternance",
    title: "Lettre de motivation pour une alternance : quoi écrire, quoi éviter",
    description:
      "La structure d’une lettre de motivation d’alternance qui se lit vite, les phrases à éviter, et comment l’adapter à chaque entreprise sans tout réécrire.",
    intro: "Une bonne lettre tient en quatre paragraphes courts et parle d’une entreprise précise.",
    sections: [
      {
        heading: "La structure qui marche",
        paragraphs: ["Quatre blocs, dans cet ordre, sur une seule page."],
        list: [
          "L’objet : le poste et le type de contrat, par exemple « Candidature en alternance au poste d’assistant marketing ».",
          "Toi : la formation que tu prépares, ton rythme et ta date de début.",
          "Eux : pourquoi cette entreprise, avec un fait précis (son activité, un produit, sa taille).",
          "Vous : ce que tu apportes, avec un exemple vécu, puis ta disponibilité pour un entretien.",
        ],
      },
      {
        heading: "Ce qu’il faut éviter",
        paragraphs: [
          "Les recruteurs lisent les mêmes phrases toute la journée. Celles-ci ne disent rien de toi :",
        ],
        list: [
          "« Dynamique et motivé(e) » sans exemple derrière.",
          "« Votre entreprise, leader de son secteur » : si tu peux l’écrire à n’importe qui, enlève-le.",
          "Une lettre identique pour tout le monde, avec le nom d’une autre entreprise oublié dedans.",
          "Des compétences que tu n’as pas. Elles se voient au premier entretien.",
        ],
      },
      {
        heading: "Adapter sans tout réécrire",
        paragraphs: [
          "Garde une lettre de base solide et ne change que ce qui dépend de l’entreprise : son nom, l’intitulé du poste, et une phrase sur ce qui t’attire chez elle. Reprends les mots de l’annonce quand ils décrivent vraiment ton expérience.",
          "C’est ce que fait JobGPT : il remplace les repères de ta lettre de base par le nom de l’entreprise et le poste, cite les compétences que l’annonce demande et que ton CV contient déjà, et te montre chaque passage modifié avant que tu envoies.",
        ],
      },
    ],
    next: { label: "Préparer ma première lettre", href: "/onboarding/1" },
  },
  {
    slug: "candidature-spontanee",
    title: "Candidature spontanée : écrire à une entreprise qui n’a rien publié",
    description:
      "Comment choisir les entreprises, à qui écrire, quoi dire en quelques lignes et quand relancer une candidature spontanée en alternance ou en stage.",
    intro:
      "Une candidature spontanée ne répond à aucune annonce : c’est toi qui proposes ton profil.",
    sections: [
      {
        heading: "Choisir les bonnes entreprises",
        paragraphs: [
          "Écris à des entreprises qui ont une raison de te répondre : elles exercent dans ton domaine, elles sont assez proches pour que tu t’y rendes, et leur taille permet d’accueillir un alternant ou un stagiaire.",
          "Une entreprise qui a déjà embauché des alternants est une bonne piste, mais ce n’est jamais une garantie qu’un poste est ouvert cette année.",
        ],
      },
      {
        heading: "À qui l’adresser",
        paragraphs: [
          "Dans une petite entreprise, le dirigeant décide souvent lui-même. Dans une plus grande, vise le service où tu veux travailler ou les ressources humaines. Le nom des dirigeants d’une entreprise est public : il figure au registre des entreprises.",
        ],
      },
      {
        heading: "Quoi écrire",
        paragraphs: ["Court, précis, et tourné vers eux."],
        list: [
          "Dès l’objet : « Candidature spontanée en alternance » et le métier visé.",
          "Une phrase sur toi : ta formation, ton rythme, ta date de début.",
          "Une phrase sur eux : pourquoi cette entreprise et pas une autre.",
          "Ce que tu sais faire, avec un exemple, et ta disponibilité pour un échange.",
        ],
      },
      {
        heading: "Relancer",
        paragraphs: [
          "Sans nouvelle après quelques jours, relance une fois, brièvement. Si l’entreprise a un téléphone, un appel poli obtient souvent une réponse plus vite qu’un second message.",
        ],
      },
      {
        heading: "Avec JobGPT",
        paragraphs: [
          "JobGPT te montre les entreprises de ton domaine près de chez toi, avec leur fiche, leurs dirigeants et leur téléphone quand il est connu. Il adapte ta lettre à l’entreprise, l’ajoute à ton suivi et te rappelle de relancer. Il n’envoie rien à ta place.",
        ],
      },
    ],
    next: { label: "Voir les entreprises de mon domaine", href: "/onboarding/1" },
  },
  {
    slug: "salaire-alternance",
    title: "Salaire en alternance : combien tu touches",
    description:
      "Le salaire minimum d’un alternant dépend de ton contrat, de ton âge et de ton année. La règle expliquée simplement, avec un simulateur.",
    intro:
      "Ton salaire minimum est un pourcentage du Smic, fixé par la loi selon ton contrat, ton âge et ton année.",
    sections: [
      {
        heading: "En contrat d’apprentissage",
        paragraphs: [
          "Le pourcentage augmente avec ton âge et avec chaque année de contrat. La première année, il va de 27 % du Smic avant 18 ans à 53 % entre 21 et 25 ans ; la troisième année, de 55 % à 78 %. À partir de 26 ans, tu touches au moins le Smic.",
          "Quand tu changes de tranche d’âge en cours de contrat, ton salaire suit.",
        ],
      },
      {
        heading: "En contrat de professionnalisation",
        paragraphs: [
          "Il n’y a pas d’année de contrat dans le calcul : c’est ton âge et ton niveau de qualification qui comptent. Avant 21 ans, 55 % du Smic, ou 65 % si tu as déjà un bac professionnel ou un titre de ce niveau ; de 21 à 25 ans, 70 % ou 80 % ; à partir de 26 ans, au moins le Smic.",
        ],
      },
      {
        heading: "Ce sont des minimums",
        paragraphs: [
          "Ta convention collective ou ton employeur peut prévoir plus. À partir de 21 ans, c’est le salaire minimum prévu par la convention collective pour ton poste qui sert de base s’il est plus élevé que le Smic.",
          "Les montants sont exprimés en brut. Demande toujours le brut mensuel par écrit avant de signer.",
        ],
      },
    ],
    sources: [
      {
        label: "Contrat d’apprentissage (Service-Public)",
        href: "https://www.service-public.gouv.fr/particuliers/vosdroits/F2918",
      },
      {
        label: "Contrat de professionnalisation (Service-Public)",
        href: "https://www.service-public.gouv.fr/particuliers/vosdroits/F15478",
      },
      {
        label: "Smic (Service-Public)",
        href: "https://www.service-public.gouv.fr/particuliers/vosdroits/F2300",
      },
    ],
    next: { label: "Calculer mon salaire", href: "/outils/salaire-alternance" },
  },
];

export function findGuide(slug: string): Guide | null {
  return GUIDES.find((guide) => guide.slug === slug) ?? null;
}
