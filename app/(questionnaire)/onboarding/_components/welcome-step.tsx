import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

const QUESTIONS = [
  "Qui vous êtes et ce que vous étudiez",
  "Le métier qui vous attire",
  "Où vous voulez travailler",
  "Votre CV et votre lettre de motivation",
];

export function WelcomeStep({
  firstName,
  visitor = false,
}: {
  firstName: string | null;
  visitor?: boolean;
}) {
  return (
    <div className="grid gap-6">
      <p className="text-lg text-muted-foreground">
        {firstName ? `Bonjour ${firstName} ! ` : ""}Quelques questions rapides, et nous vous
        montrons les offres faites pour vous.
      </p>
      <ul className="grid gap-2 text-sm">
        {QUESTIONS.map((question) => (
          <li key={question} className="flex items-center gap-3">
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            {question}
          </li>
        ))}
      </ul>
      {visitor ? (
        <p className="text-sm text-muted-foreground">
          Deux minutes, sans compte. Vous créerez le vôtre à la fin pour garder vos réponses.
        </p>
      ) : null}
      <Link
        href="/onboarding/2"
        className={`${buttonVariants({ variant: "shiny", size: "lg" })} h-12 w-fit px-7 text-base`}
      >
        C’est parti <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
