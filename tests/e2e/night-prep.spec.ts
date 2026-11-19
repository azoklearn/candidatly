import { expect, test } from "@playwright/test";

import { loadState, OFFER_TITLE, SCHOOL_OFFER_TITLE } from "./support";

/**
 * Night preparation (docs/QUESTIONS.md C123): the scheduled route prepares the letter of
 * the best offers for the students who asked, and nothing is sent.
 */
test("letters are prepared at night for the students who asked for it", async ({
  page,
  request,
}) => {
  const { users } = loadState();
  // The route only answers the scheduler.
  expect((await request.post("/api/cron/night-prep")).status()).toBe(401);
  // Narrowed to the test student: the linked project also holds real accounts, and a test
  // run must never prepare letters for them.
  const night = {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    data: { only: users.night.id },
  };
  const run = await request.post("/api/cron/night-prep", night);
  expect(run.status()).toBe(200);
  expect(await run.json()).toMatchObject({ users: 1, prepared: 1 });
  // A second night adds nothing for an offer that already has its letter.
  const again = await request.post("/api/cron/night-prep", night);
  expect(await again.json()).toMatchObject({ users: 1, prepared: 0 });
  // An account that is not an id is refused rather than widened to everybody.
  expect(
    (await request.post("/api/cron/night-prep", { ...night, data: { only: "x" } })).status(),
  ).toBe(400);

  await page.goto(users.night.login);
  // The dashboard puts the letters of the night at the top of what to do (C124).
  await page.goto("/dashboard");
  const todo = page.getByRole("region", { name: "À faire maintenant" });
  await expect(todo.getByText("1 lettre préparée cette nuit")).toBeVisible();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Chaque nuit, la lettre est préparée" })
      .getByText("Activée"),
  ).toBeVisible();
  await todo.getByRole("link", { name: /Relire/ }).click();
  await expect(page).toHaveURL(/\/applications$/);
  await expect(page.getByText("Préparation de nuit activée")).toBeVisible();
  await expect(page.getByText("1 lettre préparée vous attend")).toBeVisible();
  const prepared = page.getByRole("listitem").filter({ hasText: OFFER_TITLE });
  await expect(prepared.getByText("Préparée cette nuit")).toBeVisible();
  await expect(prepared.getByText("Lettre en préparation")).toBeVisible();
  // The offer managed by a school gets no letter nobody asked for.
  await expect(page.getByText(SCHOOL_OFFER_TITLE)).toHaveCount(0);

  // The letter is a draft to read: adapted by the usual rules, sent by the student.
  await prepared.getByRole("link", { name: OFFER_TITLE }).click();
  await expect(page.locator("mark").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "J’ai envoyé ma candidature" })).toBeVisible();

  await page.goto("/applications");
  await page.getByRole("button", { name: "Désactiver" }).click();
  await expect(page.getByRole("button", { name: "Activer" })).toBeVisible();
});
