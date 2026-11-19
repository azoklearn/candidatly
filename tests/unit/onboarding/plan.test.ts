import { describe, expect, it } from "vitest";

import {
  buildPlan,
  isOfferedStart,
  planAnswerLabels,
  START_TIMING_PATTERN,
  startLabel,
  startMonths,
  weeksUntil,
  type PlanAnswers,
} from "@/lib/onboarding/plan";

const NOW = new Date("2026-11-19T10:00:00Z");
const answers = (patch: Partial<PlanAnswers> = {}): PlanAnswers => ({
  situation: "has_school",
  startTiming: "2027-09",
  rhythm: "low",
  blocker: "offers",
  companiesOnly: false,
  ...patch,
});
const text = (value: string) => value.replace(/\s/g, " ");

describe("start of the contract (C118)", () => {
  it("offers the twelve coming months, the current one first", () => {
    const months = startMonths(NOW);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ value: "2026-11", label: "nov. 2026" });
    expect(months[2]?.value).toBe("2027-01");
    expect(months[11]?.value).toBe("2027-10");
  });

  it("accepts only the answers that were shown", () => {
    expect(isOfferedStart("asap", NOW)).toBe(true);
    expect(isOfferedStart("unknown", NOW)).toBe(true);
    expect(isOfferedStart("2027-09", NOW)).toBe(true);
    expect(isOfferedStart("2026-10", NOW)).toBe(false);
    expect(isOfferedStart("2029-01", NOW)).toBe(false);
    expect(START_TIMING_PATTERN.test("2027-13")).toBe(false);
    expect(START_TIMING_PATTERN.test("2027-9")).toBe(false);
  });

  it("counts whole weeks to the first day of the month, never below zero", () => {
    expect(weeksUntil("2027-09", NOW)).toBe(40);
    expect(weeksUntil("2026-11", NOW)).toBe(0);
    expect(weeksUntil("asap", NOW)).toBeNull();
    expect(startLabel("2027-09")).toBe("septembre 2027");
    expect(startLabel("unknown")).toBeNull();
  });
});

describe("the plan (C118)", () => {
  it("waits for the four answers: an older account gets no plan", () => {
    expect(buildPlan(answers({ blocker: null }), NOW)).toBeNull();
    expect(buildPlan(answers({ situation: null }), NOW)).toBeNull();
  });

  it("sets the goal on the calendar", () => {
    const plan = buildPlan(answers(), NOW);
    expect(plan?.goal.title).toBe("Trouver un contrat avant septembre 2027");
    expect(plan?.goal.body).toBe("Il te reste 40 semaines pour y arriver.");
    expect(buildPlan(answers({ startTiming: "asap" }), NOW)?.goal.title).toBe(
      "Trouver un contrat le plus vite possible",
    );
    expect(buildPlan(answers({ startTiming: "unknown" }), NOW)?.goal.title).toBe(
      "Trouver un contrat, à ton rythme",
    );
    expect(buildPlan(answers({ startTiming: "2026-11" }), NOW)?.goal.body).toMatch(/maintenant/);
  });

  it("advises a rhythm from the one they have today", () => {
    expect(buildPlan(answers({ rhythm: "low" }), NOW)?.rhythm.title).toBe(
      "Commence par 5 candidatures par semaine",
    );
    expect(buildPlan(answers({ rhythm: "medium" }), NOW)?.rhythm.title).toBe(
      "Vise 10 candidatures par semaine",
    );
    expect(buildPlan(answers({ rhythm: "high" }), NOW)?.rhythm.title).toBe("Garde ton rythme");
  });

  it("starts with what blocks them most", () => {
    const first = (blocker: string) => buildPlan(answers({ blocker }), NOW)?.first.title;
    expect(first("offers")).toBe("On commence par tes offres");
    expect(first("answers")).toBe("On commence par ta lettre");
    expect(first("time")).toBe("On commence par te faire gagner du temps");
    expect(first("companies")).toBe("On commence par les entreprises qui recrutent");
  });

  it("speaks of companies, not offers, for an internship or a student job (C106)", () => {
    const plan = buildPlan(answers({ companiesOnly: true, blocker: "answers" }), NOW);
    expect(plan?.goal.title).toBe("Trouver une entreprise avant septembre 2027");
    expect(plan?.first.title).toBe("On commence par tes entreprises");
    const words = Object.values(plan ?? {})
      .flatMap((line) => [line.title, line.body])
      .join(" ");
    expect(words).not.toMatch(/offre|lettre/);
  });

  it("promises no result and quotes no statistic", () => {
    for (const rhythm of ["low", "medium", "high"]) {
      for (const blocker of ["offers", "answers", "time", "companies"]) {
        const plan = buildPlan(answers({ rhythm, blocker, startTiming: "asap" }), NOW);
        const words = Object.values(plan ?? {})
          .flatMap((line) => [line.title, line.body])
          .join(" ");
        expect(words).not.toMatch(/%|garanti|réponse sur|fois plus/i);
        expect(words).not.toMatch(/\bvotre\b|\bvos\b|\bvous\b/i);
      }
    }
  });

  it("names the answers for the admin pages", () => {
    expect(
      planAnswerLabels({
        situation: "started",
        startTiming: "2027-01",
        rhythm: "high",
        blocker: "time",
      }),
    ).toEqual({
      situation: "Ma formation a commencé, toujours rien",
      start: "janvier 2027",
      rhythm: "10 ou plus par semaine",
      blocker: "Postuler me prend trop de temps",
    });
    expect(
      text(
        planAnswerLabels({ situation: null, startTiming: "asap", rhythm: null, blocker: null })
          .start ?? "",
      ),
    ).toBe("Dès que possible");
  });
});
