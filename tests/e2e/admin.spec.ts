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
  await expect(page.getByText(users.student.email)).toBeVisible();
});
