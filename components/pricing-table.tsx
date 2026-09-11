"use client";

import { cn } from "cn";
import Link from "next/link";
import { useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import {
  BILLINGS,
  PLANS,
  formatEuros,
  priceView,
  type Billing,
  type FeaturedBadge,
} from "@/lib/pricing";

const BILLING_LABELS: Record<Billing, string> = { monthly: "Mensuel", annual: "Annuel" };

/**
 * The three plans with a monthly / annual switch (annual by default). Without `choose`,
 * the buttons lead to sign-up; with it, they record the plan (C82).
 */
export function PricingTable({
  badge,
  choose,
}: {
  badge: FeaturedBadge;
  choose?: (formData: FormData) => Promise<void>;
}) {
  const [billing, setBilling] = useState<Billing>("annual");

  return (
    <div className="grid gap-8">
      <div
        role="radiogroup"
        aria-label="Période de facturation"
        className="mx-auto inline-flex rounded-full border bg-card p-1 text-sm"
      >
        {BILLINGS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={billing === value}
            onClick={() => setBilling(value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-medium transition-colors",
              billing === value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {BILLING_LABELS[value]}
            {value === "annual" ? (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.7rem] font-semibold text-foreground">
                2 mois offerts
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <ul className="grid gap-5 lg:grid-cols-3 lg:items-start">
        {PLANS.map((plan) => {
          const view = priceView(plan, billing);
          const featured = plan.id === badge.planId;
          return (
            <li
              key={plan.id}
              className={cn(
                "relative grid content-start gap-5 rounded-3xl border bg-card p-6",
                featured && "border-foreground shadow-[6px_6px_0_var(--ink)] lg:-mt-3",
              )}
            >
              {featured ? (
                <span className="absolute -top-3 left-6 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
                  ✦ {badge.label}
                </span>
              ) : null}
              <div className="grid gap-1">
                <h2 className="text-xl font-bold tracking-[-0.03em]">{plan.name}</h2>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </div>
              <div className="grid gap-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  {view.struckCents ? (
                    <s className="text-lg text-muted-foreground">
                      <span className="sr-only">Prix au mois : </span>
                      {formatEuros(view.struckCents)}
                    </s>
                  ) : null}
                  <span className="text-4xl font-bold tracking-[-0.05em]">
                    {formatEuros(view.mainCents)}
                  </span>
                  <span className="text-sm text-muted-foreground">/mois</span>
                </p>
                <p className="text-sm font-semibold text-brand">
                  soit {formatEuros(view.perDayCents)} par jour
                </p>
                <p className="text-xs text-muted-foreground">
                  {view.billedLabel ?? "facturé chaque mois"}
                </p>
              </div>
              {choose ? (
                <form action={choose}>
                  <input type="hidden" name="plan" value={plan.id} />
                  <input type="hidden" name="billing" value={billing} />
                  <SubmitButton
                    variant={featured ? "shiny" : "default"}
                    size="lg"
                    className="w-full"
                    pendingLabel="Un instant…"
                  >
                    Choisir {plan.name}
                  </SubmitButton>
                </form>
              ) : (
                <Link
                  href="/signup"
                  className={cn(
                    buttonVariants({ variant: featured ? "shiny" : "default", size: "lg" }),
                    "w-full",
                  )}
                >
                  Choisir {plan.name}
                </Link>
              )}
              <ul className="grid gap-2.5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className={feature.soon ? "text-muted-foreground" : "text-brand"}
                    >
                      ✓
                    </span>
                    <span className={cn(feature.soon && "text-muted-foreground")}>
                      {feature.label}
                      {feature.soon ? (
                        <span className="ml-2 inline-block rounded-full border px-2 py-0.5 text-[0.7rem] font-medium">
                          Bientôt
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
