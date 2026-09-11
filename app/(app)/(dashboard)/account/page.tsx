import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { DocumentsStep } from "@/app/(app)/onboarding/_components/documents-step";
import { LocationStep } from "@/app/(app)/onboarding/_components/location-step";
import { ProfileForm } from "@/app/(app)/onboarding/_components/profile-form";
import { RomeStep } from "@/app/(app)/onboarding/_components/rome-step";
import { loadOnboarding } from "@/app/(app)/onboarding/data";
import { buttonVariants } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/session";
import { loadAccess } from "@/lib/billing/access";
import { formatDate } from "@/lib/format";
import { PLANS } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = { title: "Compte" };

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid max-w-2xl gap-4 border-t pt-8">
      <div className="grid gap-1">
        <h2 className="text-lg font-bold tracking-[-0.03em]">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function AccountPage() {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const [{ data: claims }, data, access] = await Promise.all([
    supabase.auth.getClaims(),
    loadOnboarding(supabase, userId),
    loadAccess(supabase, userId),
  ]);
  const subscription = access.subscription;
  const planName = PLANS.find((plan) => plan.id === subscription?.plan)?.name;
  const periodEnd = formatDate(subscription?.current_period_end);
  const email = typeof claims?.claims.email === "string" ? claims.claims.email : null;
  const codes =
    data.profile.rome_codes.length > 0
      ? await supabase.from("rome_codes").select("code, label").in("code", data.profile.rome_codes)
      : { data: [] };

  return (
    <div className="grid gap-8">
      <header className="fade-up grid gap-2">
        <p className="eyebrow">Réglages</p>
        <h1 className="page-title">
          Votre <em>compte</em>
        </h1>
        {email ? <p className="text-sm text-muted-foreground">Connecté avec {email}</p> : null}
      </header>
      {access.paywall || subscription ? (
        <Section title="Votre forfait">
          {subscription ? (
            <div className="grid gap-2 text-sm">
              <p>
                Forfait <strong>{planName}</strong>
                {subscription.billing === "annual" ? ", facturé à l’année" : ", facturé au mois"}.
              </p>
              {periodEnd ? (
                <p className="text-muted-foreground">
                  {subscription.cancel_at_period_end ? "Se termine le " : "Renouvellement le "}
                  {periodEnd}.
                </p>
              ) : null}
              {subscription.manage_url ? (
                <a
                  href={subscription.manage_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline" }) + " w-fit"}
                >
                  Gérer mon abonnement sur Whop
                </a>
              ) : null}
            </div>
          ) : access.exempt ? (
            <p className="text-sm text-muted-foreground">Accès complet offert à ce compte.</p>
          ) : (
            <Link href="/forfait" className={buttonVariants() + " w-fit"}>
              Choisir un forfait
            </Link>
          )}
        </Section>
      ) : null}
      <Section title="Profil">
        <ProfileForm profile={data.profile} mode="account" />
      </Section>
      <Section
        title="Métiers recherchés"
        description="Modifier vos métiers relance la recherche d’offres."
      >
        <RomeStep
          initialText={data.profile.domain_free_text ?? ""}
          selected={codes.data ?? []}
          mode="account"
        />
      </Section>
      <Section
        title="Zone de recherche"
        description="Modifier votre zone relance la recherche d’offres."
      >
        <LocationStep
          initialLabel={data.profile.location_label}
          initialCitycode={data.profile.insee_code}
          initialRadius={data.profile.search_radius_km}
          mode="account"
        />
      </Section>
      <Section
        title="CV et lettre de base"
        description="La nouvelle lettre servira pour vos prochaines candidatures."
      >
        <DocumentsStep userId={userId} cv={data.cv} letter={data.letter} showContinue={false} />
      </Section>
      <Section
        title="Vos données"
        description="Vous pouvez récupérer ou effacer toutes vos données à tout moment."
      >
        <a href="/api/account/export" className={buttonVariants({ variant: "outline" }) + " w-fit"}>
          Télécharger mes données (JSON)
        </a>
        <p className="text-sm text-muted-foreground">
          Le détail des données et de leur usage figure dans la{" "}
          <Link href="/confidentialite" className="underline underline-offset-4">
            politique de confidentialité
          </Link>
          .
        </p>
        <DeleteAccountForm />
      </Section>
    </div>
  );
}
