import { expect, test } from "@playwright/test";

import { loadState, OFFER_TITLE } from "./support";

test("a student prepares, sends and tracks an application, then exports their data", async ({
  page,
}) => {
  const { users } = loadState();
  await page.goto(users.student.login);
  await expect(page).toHaveURL(/\/offers$/);
  await expect(page.getByRole("heading", { name: "Vos offres" })).toBeVisible();
  // Few offers: companies that hire apprentices nearby complete the page (C80).
  await expect(
    page.getByRole("heading", {
      name: "Entreprises à fort potentiel d’embauche près de chez vous",
    }),
  ).toBeVisible();
  // The search may also hold real companies: check the seeded one, not a total.
  const seeded = page.getByRole("listitem").filter({ hasText: "Atelier numérique 1 (test E2E)" });
  await expect(
    seeded.getByRole("link", { name: /Envoyer une candidature spontanée/ }),
  ).toHaveAttribute("href", /labonnealternance/);
  // The phone published with the company is a real contact channel (C87).
  await expect(seeded.getByRole("link", { name: /Appeler 01 23 45 67 89/ })).toHaveAttribute(
    "href",
    "tel:+33123456789",
  );

  await page.getByRole("link", { name: OFFER_TITLE }).click();
  await expect(
    page.getByText("L’offre ne donne ni SIRET ni nom d’employeur exploitable."),
  ).toBeVisible();
  // The seeded offer publishes no phone: the card says so instead of inventing a channel.
  await expect(page.getByText("Contacter le recruteur")).toBeVisible();
  await expect(page.getByText("Passez par le site de l’offre")).toBeVisible();
  await page.getByRole("button", { name: "Préparer ma candidature" }).click();

  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]{36}$/);
  await expect(page.locator("mark").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Candidater sur le site de l’offre" }),
  ).toHaveAttribute("href", "https://example.org/postuler");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "J’ai envoyé ma candidature" }).click();
  await expect(page.getByText(/Envoyée le /)).toBeVisible();
  await expect(page.getByText("Statut : En attente de réponse")).toBeVisible();

  await page.getByRole("button", { name: "Réponse positive" }).click();
  await expect(page.getByText("Statut : Réponse positive")).toBeVisible();

  await page.goto("/applications");
  await expect(page.getByRole("heading", { name: "Réponses (1)" })).toBeVisible();

  await page.goto("/offers");
  await expect(page.getByText("Candidature envoyée")).toBeVisible();

  // The page shown after the questionnaire: what the search found, then the plans (C82).
  await page.goto("/forfait");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("1 offre");
  await expect(page.getByText("Recommandé")).toBeVisible();
  await page.getByRole("button", { name: "Choisir Plus" }).click();
  await expect(page).toHaveURL(/\/offers$/);

  const response = await page.request.get("/api/account/export");
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.profile.first_name).toBe("Camille");
  expect(data.profile.chosen_plan).toBe("plus");
  expect(data.profile.chosen_billing).toBe("annual");
  expect(data.applications).toHaveLength(1);
  expect(data.applications[0].status).toBe("replied_positive");
});
