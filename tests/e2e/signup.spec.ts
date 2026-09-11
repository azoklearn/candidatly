import { expect, test } from "@playwright/test";

import { loadState } from "./support";

test("a student signs up and lands on the questionnaire without any email", async ({ page }) => {
  const { signup } = loadState();
  await page.goto("/signup");
  await page.getByLabel("Adresse email").fill(signup.email);
  await page.getByLabel("Mot de passe").fill(signup.password);
  await page
    .locator("form")
    .filter({ has: page.getByLabel("Mot de passe") })
    .locator('button[type="submit"]')
    .click();
  await expect(page).toHaveURL(/\/onboarding\/1$/);
  await expect(page.getByRole("heading", { name: "Bienvenue !" })).toBeVisible();
});
