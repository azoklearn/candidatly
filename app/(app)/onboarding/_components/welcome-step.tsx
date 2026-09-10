import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ONBOARDING_STEPS } from "@/lib/onboarding/state";

export function WelcomeStep({ firstName }: { firstName: string | null }) {
  return (
    <div className="grid gap-6">
      <p className="text-muted-foreground">
        {firstName ? `Bienvenue ${firstName}, votre` : "Votre"} compte est créé. Quelques minutes
        suffisent pour configurer votre recherche d’alternance.
      </p>
      <ol className="grid gap-2 text-sm">
        {ONBOARDING_STEPS.slice(1).map((item) => (
          <li key={item.step} className="flex gap-3">
            <span className="w-5 text-muted-foreground">{item.step}.</span>
            {item.title}
          </li>
        ))}
      </ol>
      <Link href="/onboarding/2" className={buttonVariants({ size: "lg" }) + " w-fit"}>
        Commencer
      </Link>
    </div>
  );
}
