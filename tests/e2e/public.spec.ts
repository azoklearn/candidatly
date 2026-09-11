import { expect, test } from "@playwright/test";

test("the landing page and the legal pages are public", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Créer mon compte gratuitement" })).toBeVisible();
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
