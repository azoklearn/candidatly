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
  const run = await request.post("/api/cron/night-prep", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(run.status()).toBe(200);
  expect((await run.json()).prepared).toBeGreaterThanOrEqual(1);
  // A second night adds nothing for an offer that already has its letter.
  const again = await request.post("/api/cron/night-prep", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect((await again.json()).prepared).toBe(0);

  await page.goto(users.night.login);
  await page.goto("/applications");
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
