import { expect, test } from "@playwright/test";

test("the landing page and the legal pages are public", async ({ page }) => {
  await page.goto("/");
  const headline = page.getByRole("heading", { level: 1 });
  await expect(headline).toBeVisible();
  // The headline types "alternance", erases it and types "stage", over and over. The
  // check targets the animated span: the sibling text is there for screen readers.
  const typed = headline.locator("[aria-hidden='true']");
  await expect(typed).toHaveText("stage.", { timeout: 15_000 });
  await expect(typed).toHaveText("alternance.", { timeout: 15_000 });
  // The word types in a box as wide as the longest one: the headline never moves.
  const box = headline.locator(".typed");
  const wide = await box.boundingBox();
  await expect(typed).toHaveText("stage.", { timeout: 15_000 });
  expect((await box.boundingBox())?.width).toBe(wide?.width);
  // The CV is the way in; the questionnaire stays one click away (C95).
  await expect(page.getByRole("button", { name: "Analyser mon CV" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Je n’ai pas mon CV ici/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Trouver mon stage\/alternance/ })).toBeVisible();
  // No beta or price wording on the landing page (C81).
  await expect(page.getByText(/bêta|0 €|gratuit/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Prendre une longueur d’avance" })).toBeVisible();
  await page.getByRole("link", { name: "Tarifs" }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Un forfait pour chaque recherche" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /^Choisir / })).toHaveCount(3);
  // 1 mois, 3 mois and À vie side by side, no billing switch (C113).
  await expect(page.getByText("soit 0,66 € par jour")).toBeVisible();
  await expect(page.getByText("soit 9,97 € par mois")).toBeVisible();
  await expect(page.getByText("un seul paiement, accès pour toujours")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  // The public tools and guides (C122): the simulator follows the legal grid, in the browser.
  await page.goto("/outils/salaire-alternance");
  await expect(page.getByText("soit 43 % du Smic")).toBeVisible();
  await page.getByRole("button", { name: "21 à 25 ans" }).click();
  await page.getByRole("button", { name: "2e année" }).click();
  await expect(page.getByText("soit 61 % du Smic")).toBeVisible();
  await expect(page.getByText(/1\s138,88\s€/)).toBeVisible();
  await page.getByRole("button", { name: "Professionnalisation" }).click();
  await expect(page.getByText("soit 70 % du Smic")).toBeVisible();
  await page.goto("/guides");
  await page.getByRole("link", { name: /Trouver une alternance/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: /Trouver une alternance/ }),
  ).toBeVisible();
  await page.goto("/alternance/ville/lyon");
  await expect(page.getByRole("heading", { level: 1, name: "Alternance à Lyon" })).toBeVisible();
  // No figure about offers on a public page.
  await expect(page.getByRole("main")).not.toContainText(/\d+ offres/);
  for (const [path, title] of [
    ["/mentions-legales", "Mentions légales"],
    ["/confidentialite", "Politique de confidentialité"],
    ["/conditions", "Conditions d’utilisation"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  }
});

test("private pages send visitors to the login page", async ({ page }) => {
  await page.goto("/offers");
  await expect(page).toHaveURL(/\/login/);
});

test("responses carry the security headers", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
});
