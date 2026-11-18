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
                "panel rise relative grid content-start gap-5 rounded-[1.75rem] border bg-card p-7",
                featured && "plan-featured lg:-mt-4 lg:pb-9",
              )}
            >
              {featured ? (
                <span className="plan-badge absolute -top-3.5 left-7 rounded-full px-3.5 py-1.5 text-xs font-semibold">
                  ✦ {badge.label}
                </span>
              ) : null}
              <div className="grid gap-1">
                <h2 className="font-heading text-2xl font-semibold tracking-[-0.04em]">
                  {plan.name}
                </h2>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </div>
              <div className="grid gap-1 tabular-nums">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-heading text-5xl font-semibold tracking-[-0.055em]">
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
