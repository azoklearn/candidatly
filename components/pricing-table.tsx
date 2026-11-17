"use client";

import { cn } from "cn";
import Link from "next/link";
import type { CSSProperties } from "react";

import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { PLANS, formatEuros, priceView, type FeaturedBadge } from "@/lib/pricing";

/**
 * The three plans: 1 mois, 3 mois and À vie (C113), each with its own features. Without
 * `choose`, the buttons lead to the questionnaire; with it, they record the plan and open
 * the payment (C82). Prices are set in tabular figures.
 */
export function PricingTable({
  badge,
  choose,
}: {
  badge: FeaturedBadge;
  choose?: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="grid gap-8 scroll-mt-24" id="forfaits">
      <ul className="grid gap-5 lg:grid-cols-3 lg:items-start">
        {PLANS.map((plan, index) => {
          const view = priceView(plan);
          const featured = plan.id === badge.planId;
          return (
            <li
              key={plan.id}
              style={{ "--i": index } as CSSProperties}
              className={cn(
                "panel rise relative grid content-start gap-5 rounded-3xl border bg-card p-6",
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
              <div className="grid gap-1 tabular-nums">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-4xl font-bold tracking-[-0.05em]">
                    {formatEuros(view.mainCents)}
                  </span>
                  <span className="text-sm text-muted-foreground">{view.unit}</span>
                </p>
                {view.perMonthLabel || view.perDayLabel ? (
                  <p className="text-sm font-semibold text-brand">
                    {view.perMonthLabel ?? view.perDayLabel}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">{view.billedLabel}</p>
                {view.savingLabel ? (
                  <p className="text-xs font-medium text-foreground">{view.savingLabel}</p>
                ) : null}
              </div>
              {choose ? (
                <form action={choose}>
                  <input type="hidden" name="plan" value={plan.id} />
                  <SubmitButton
                    variant={featured ? "shiny" : "default"}
                    size="lg"
                    className="w-full"
                    pendingLabel="Un instant…"
                  >
                    Choisir {plan.id === "premium" ? "l’accès à vie" : plan.name}
                  </SubmitButton>
                </form>
              ) : (
                <Link
                  href="/onboarding/1"
                  className={cn(
                    buttonVariants({ variant: featured ? "shiny" : "default", size: "lg" }),
                    "w-full",
                  )}
                >
                  Choisir {plan.id === "premium" ? "l’accès à vie" : plan.name}
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
