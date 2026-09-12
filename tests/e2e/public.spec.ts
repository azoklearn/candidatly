import { expect, test } from "@playwright/test";

test("the landing page and the legal pages are public", async ({ page }) => {
  await page.goto("/");
  const headline = page.getByRole("heading", { level: 1 });
  await expect(headline).toBeVisible();
  // The headline types "alternance", erases it and types "stage", over and over. The
  // check targets the animated span: the sibling text is there for screen readers.
  const typed = headline.locator("[aria-hidden='true']");
  await expect(typed).toHaveText("stage", { timeout: 15_000 });
  await expect(typed).toHaveText("alternance", { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Décrocher mon alternance" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Trouver mon stage\/alternance/ })).toBeVisible();
  // No beta or price wording on the landing page (C81).
  await expect(page.getByText(/bêta|0 €|gratuit/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Prendre une longueur d’avance" })).toBeVisible();
  await page.getByRole("link", { name: "Tarifs" }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Un forfait pour chaque recherche" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /^Choisir / })).toHaveCount(3);
  // Monthly is shown first; the annual view adds the struck monthly price.
  await expect(page.getByText("soit 0,50 € par jour")).toBeVisible();
  await page.getByRole("radio", { name: /Annuel/ }).click();
  await expect(page.getByText("soit 0,41 € par jour")).toBeVisible();
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
