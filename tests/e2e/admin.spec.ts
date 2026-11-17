import { expect, test } from "@playwright/test";

import { loadState } from "./support";

test("the admin dashboard opens for the owner only", async ({ page }) => {
  const { users } = loadState();
  // A signed-in student gets the same answer as a stranger: the page does not exist.
  await page.goto(users.outsider.login);
  await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();

  await page.goto(users.admin.login);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
  await expect(page.getByText("Questionnaires terminés")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Comptes \(\d+\)$/ })).toBeVisible();
  // The seeded student is listed, with its activity.
  await expect(page.getByText(users.student.email).first()).toBeVisible();
  // Precise times and the questionnaire answers (C114).
  await expect(page.getByRole("heading", { name: "Fil d’activité" })).toBeVisible();
  await expect(page.getByText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/).first()).toBeVisible();
  await expect(page.getByText("Alternance · Bac+3").first()).toBeVisible();

  // The search narrows the list; each account opens on its own page (C112).
  await page.getByRole("searchbox", { name: "Chercher un compte" }).fill(users.student.email);
  await page.getByRole("button", { name: "Chercher" }).click();
  await expect(page.getByRole("heading", { name: /^Comptes \(1 sur \d+\)$/ })).toBeVisible();
  await page
    .getByRole("link", { name: new RegExp(users.student.email) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/comptes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Profil et recherche" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Candidatures" })).toBeVisible();
  await expect(page.getByText("le contenu des CV et des lettres reste privé")).toBeVisible();
  await page.screenshot({
    path: process.env.ADMIN_SHOT ?? "test-results/admin-account.png",
    fullPage: true,
  });

  // Signed out, the account page sends to the login page like the rest of the app.
  const accountUrl = page.url();
  await page.context().clearCookies();
  await page.goto(accountUrl);
  await expect(page).toHaveURL(/\/login/);
});
