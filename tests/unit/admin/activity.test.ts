import { describe, expect, it } from "vitest";

import { buildActivity, type ProfileRow } from "@/lib/admin/overview";
import { formatDateTime } from "@/lib/format";

const profile = (user_id: string, created_at: string, extra: Partial<ProfileRow> = {}) =>
  ({
    user_id,
    email: `${user_id}@example.com`,
    first_name: null,
    last_name: null,
    created_at,
    onboarding_completed: true,
    chosen_plan: null,
    chosen_billing: null,
    billing_exempt: false,
    location_label: null,
    ...extra,
  }) satisfies ProfileRow;

describe("admin times (C114)", () => {
  it("prints the exact moment in Paris time", () => {
    // 13:32 UTC is 14:32 in Paris in November.
    expect(formatDateTime("2026-11-17T13:32:00Z")).toBe("17/11/2026 14:32");
    // Summer time: two hours ahead.
    expect(formatDateTime("2026-07-01T08:05:00Z")).toBe("01/07/2026 10:05");
    expect(formatDateTime(null)).toBeNull();
    expect(formatDateTime("nope")).toBeNull();
  });

  it("puts sign-ups, plans, applications and payments on one line, newest first", () => {
    const items = buildActivity({
      profiles: [
        profile("a", "2026-11-17T09:00:00Z", {
          chosen_plan: "plus",
          plan_chosen_at: "2026-11-17T09:10:00Z",
        }),
        profile("b", "2026-11-16T09:00:00Z"),
      ],
      applications: [
        {
          user_id: "a",
          created_at: "2026-11-17T09:20:00Z",
          sent_at: "2026-11-17T09:30:00Z",
          offer: { title: "Développeur web", company_name: "Atelier" },
        },
      ],
      billingEvents: [{ created_at: "2026-11-17T09:15:00Z", provider: "mollie", type: "payment" }],
      planName: (id) => (id === "plus" ? "3 mois" : "—"),
    });
    expect(items.map((item) => item.kind)).toEqual([
      "Candidature envoyée",
      "Candidature préparée",
      "Paiement",
      "Forfait choisi",
      "Inscription",
      "Inscription",
    ]);
    expect(items[0]?.detail).toBe("Développeur web · Atelier");
    expect(items[3]?.detail).toBe("3 mois");
    expect(items[2]?.userId).toBeNull();
  });

  it("keeps only the latest items", () => {
    const profiles = Array.from({ length: 50 }, (_, i) =>
      profile(`u${i}`, new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString()),
    );
    const items = buildActivity({
      profiles,
      applications: [],
      billingEvents: [],
      planName: () => "",
      limit: 5,
    });
    expect(items).toHaveLength(5);
    expect(items[0]?.userId).toBe("u49");
  });
});
