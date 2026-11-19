import { describe, expect, it } from "vitest";

import {
  buildFeatures,
  buildTasks,
  countDashboard,
  type DashboardInput,
} from "@/lib/dashboard/summary";

const NOW = Date.parse("2026-11-19T10:00:00Z");
const PAST = "2026-11-18T10:00:00Z";
const FUTURE = "2026-11-22T10:00:00Z";

function input(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    matches: [],
    applications: [],
    hasCv: true,
    hasBaseLetter: true,
    letters: true,
    nightPrep: false,
    hideNoise: true,
    companiesOnly: false,
    companies: 0,
    now: NOW,
    ...overrides,
  };
}

describe("countDashboard", () => {
  it("counts the offers the list shows: a hidden school offer is left out while new", () => {
    const counts = countDashboard(
      input({
        matches: [
          { status: "new", noise: false },
          { status: "new", noise: true },
          { status: "saved", noise: true },
          { status: "saved", noise: false },
          { status: "applied", noise: false },
        ],
      }),
    );
    expect(counts.newOffers).toBe(1);
    // An offer the student kept is never taken away, school or not.
    expect(counts.savedOffers).toBe(2);
  });

  it("counts school offers again once the student shows them", () => {
    const counts = countDashboard(
      input({
        hideNoise: false,
        matches: [
          { status: "new", noise: false },
          { status: "new", noise: true },
        ],
      }),
    );
    expect(counts.newOffers).toBe(2);
  });

  it("sorts applications by where they stand", () => {
    const counts = countDashboard(
      input({
        applications: [
          { status: "draft", nextFollowUpAt: null, preparedAtNight: true },
          { status: "ready", nextFollowUpAt: null, preparedAtNight: false },
          { status: "sent", nextFollowUpAt: PAST, preparedAtNight: false },
          { status: "viewed", nextFollowUpAt: FUTURE, preparedAtNight: false },
          { status: "replied_positive", nextFollowUpAt: PAST, preparedAtNight: false },
          { status: "no_answer", nextFollowUpAt: PAST, preparedAtNight: false },
          // Sent since: no longer a letter waiting from the night.
          { status: "sent", nextFollowUpAt: FUTURE, preparedAtNight: true },
        ],
      }),
    );
    expect(counts).toMatchObject({
      toSend: 2,
      waiting: 3,
      replies: 1,
      followUps: 1,
      nightLetters: 1,
    });
  });
});

describe("buildTasks", () => {
  it("is empty when nothing is waiting", () => {
    expect(buildTasks(input())).toEqual([]);
  });

  it("puts follow-ups first, then the night letters, then the rest", () => {
    const tasks = buildTasks(
      input({
        hasCv: false,
        matches: [{ status: "new", noise: false }],
        applications: [
          { status: "draft", nextFollowUpAt: null, preparedAtNight: true },
          { status: "ready", nextFollowUpAt: null, preparedAtNight: false },
          { status: "sent", nextFollowUpAt: PAST, preparedAtNight: false },
        ],
      }),
    );
    expect(tasks.map((task) => task.id)).toEqual([
      "follow_up",
      "night_letters",
      "to_send",
      "cv",
      "sort_offers",
    ]);
    expect(tasks[0]?.title).toBe("1 relance conseillée");
    // The night letter is not counted twice among the applications to send.
    expect(tasks[2]?.title).toBe("1 candidature à envoyer");
  });

  it("asks for the base letter only when the plan prepares letters", () => {
    const missing = { hasBaseLetter: false };
    expect(buildTasks(input(missing)).map((task) => task.id)).toEqual(["base_letter"]);
    expect(buildTasks(input({ ...missing, letters: false }))).toEqual([]);
  });

  it("speaks of companies, not offers, for an internship or a student job", () => {
    const tasks = buildTasks(
      input({ companiesOnly: true, companies: 4, matches: [{ status: "new", noise: false }] }),
    );
    expect(tasks.map((task) => task.id)).toEqual(["companies"]);
    expect(tasks[0]?.title).toBe("4 entreprises à contacter");
  });
});

describe("buildFeatures", () => {
  const byId = (overrides: Partial<DashboardInput>) =>
    new Map(buildFeatures(input(overrides)).map((feature) => [feature.id, feature]));

  it("locks the letter features on the 1 mois plan, without a link", () => {
    const features = byId({ letters: false, nightPrep: true });
    for (const id of ["letter", "spontaneous", "night"]) {
      expect(features.get(id)).toMatchObject({ state: "locked", href: null });
    }
    expect(features.get("tracking")?.state).toBe("included");
  });

  it("shows the real state of the switches", () => {
    const on = byId({ nightPrep: true, hideNoise: true });
    expect(on.get("night")).toMatchObject({ state: "on", stateLabel: "Activée" });
    expect(on.get("noise")).toMatchObject({ state: "on", stateLabel: "Activé" });
    const off = byId({ nightPrep: false, hideNoise: false });
    expect(off.get("night")?.state).toBe("off");
    expect(off.get("noise")?.state).toBe("off");
  });

  it("says which document is missing", () => {
    expect(byId({}).get("documents")?.stateLabel).toBe("À jour");
    expect(byId({ hasCv: false }).get("documents")?.stateLabel).toBe("CV à ajouter");
    expect(byId({ hasBaseLetter: false }).get("documents")?.stateLabel).toBe("Lettre à ajouter");
    expect(byId({ hasCv: false, hasBaseLetter: false }).get("documents")).toMatchObject({
      state: "todo",
      stateLabel: "À ajouter",
    });
  });

  it("never links to companies that are not there", () => {
    expect(byId({ companies: 0 }).get("companies")?.href).toBeNull();
    expect(byId({ companies: 3 }).get("companies")?.href).toBe("#entreprises");
  });

  it("drops the offer features for an internship or a student job", () => {
    const features = byId({ companiesOnly: true, companies: 2 });
    expect(features.has("offers")).toBe(false);
    expect(features.has("swipe")).toBe(false);
    expect(features.get("companies")?.href).toBe("/offers");
  });
});
