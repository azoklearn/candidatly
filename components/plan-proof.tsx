import type { CSSProperties, ReactNode } from "react";

/**
 * What answers a student's doubts right before paying: four promises the product really
 * keeps, then the questions they actually ask. Every line here must stay verifiable in the
 * product; nothing is invented, no figure is promised, and what is not built says so.
 * The wording says "tu", like the rest of the entry funnel (docs/QUESTIONS.md C93).
 */

type Commitment = { title: string; body: string; icon: string };

const COMMITMENTS: Commitment[] = [
  {
    icon: "◎",
    title: "Des offres réelles",
    body: "Uniquement des offres réellement publiées par les entreprises, retirées de ta sélection dès qu’elles expirent.",
  },
  {
    icon: "✎",
    title: "Ta lettre reste la tienne",
    body: "On l’adapte à chaque entreprise sans rien inventer, et chaque mot changé t’est montré avant que tu l’envoies.",
  },
  {
    icon: "✓",
    title: "Tu valides chaque envoi",
    body: "Rien ne part sans ton accord : tu relis, tu décides, et on suit les réponses pour te dire quand relancer.",
  },
  {
    icon: "⌫",
    title: "Tes données t’appartiennent",
    body: "Tu exportes tout en un clic et tu supprimes ton compte quand tu veux : la suppression est réelle, pas un drapeau en base.",
  },
];

type Question = { question: string; answer: ReactNode };

/** `preview` is what the student sees before paying, which differs between the two pages. */
function questions(preview: ReactNode): Question[] {
  return [
    {
      question: "Je peux arrêter quand je veux ?",
      answer:
        "Oui. Ton abonnement se gère depuis Whop, qui encaisse le paiement : tu l’arrêtes en deux clics et tu gardes l’accès jusqu’à la fin de la période déjà payée. En mensuel, c’est un mois au maximum.",
    },
    { question: "Combien d’offres je vais voir ?", answer: preview },
    {
      question: "Vous envoyez mes candidatures à ma place ?",
      answer:
        "Pas encore. Aujourd’hui tu candidates sur le site de l’offre avec ta lettre déjà prête, et JobGPT suit tes réponses. L’envoi direct est marqué « Bientôt » dans les forfaits : il n’est pas compris dans ce que tu paies aujourd’hui.",
    },
    {
      question: "Et pour un stage ou un job étudiant ?",
      answer:
        "On te montre les entreprises de ton domaine près de chez toi, les plus proches d’abord, avec leur fiche et leur téléphone quand on le connaît. À toi de leur proposer ton profil avec ton CV.",
    },
    {
      question: "Et si je trouve mon alternance ?",
      answer: "Tu arrêtes ton abonnement. C’est exactement le but du produit.",
    },
  ];
}

export function PlanProof({ preview }: { preview: ReactNode }) {
  return (
    <div className="grid gap-10">
      <section aria-labelledby="engagements" className="grid gap-4">
        <h2 id="engagements" className="section-title text-center">
          Ce qu’on <em>tient</em>, noir sur blanc
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COMMITMENTS.map((commitment, index) => (
            <li
              key={commitment.title}
              style={{ "--i": index } as CSSProperties}
              className="panel rise grid content-start gap-2 rounded-2xl border bg-card p-4"
            >
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-xl bg-brand-soft text-sm text-foreground"
              >
                {commitment.icon}
              </span>
              <h3 className="font-semibold tracking-[-0.02em]">{commitment.title}</h3>
              <p className="text-sm text-muted-foreground">{commitment.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="questions" className="mx-auto grid w-full max-w-2xl gap-3">
        <h2 id="questions" className="section-title text-center">
          Les questions qu’on nous pose <em>avant de payer</em>
        </h2>
        <ul className="grid gap-2">
          {questions(preview).map((item) => (
            <li key={item.question}>
              <details className="faq panel rounded-2xl border bg-card px-4">
                <summary className="flex items-center gap-3 py-3.5 text-sm font-medium">
                  {item.question}
                </summary>
                <p className="pb-4 text-sm text-muted-foreground">{item.answer}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
