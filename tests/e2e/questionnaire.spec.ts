import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { adminClient } from "./support";

/** The questionnaire is answered before the account exists (docs/QUESTIONS.md C91). */

const DRAFT = {
  first_name: "Alex",
  last_name: "Visiteur",
  school: "IUT de Lyon",
  degree_label: "BUT Informatique",
  diploma_level: "bac+3",
  target_contract: "alternance",
  rome_codes: ["M1805"],
  rome_version: 61,
  location_label: "Lyon",
  location_lat: 45.76,
  location_lng: 4.84,
  insee_code: "69123",
  search_radius_km: 30,
};

test("a visitor answers the first questions without an account", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Décrocher mon alternance" }).click();
  await expect(page).toHaveURL(/\/onboarding\/1$/);
  await page.getByRole("link", { name: /C’est parti/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/2$/);
  await page.getByLabel("Prénom").fill("Alex");
  await page.getByLabel("Nom", { exact: true }).fill("Visiteur");
  await page.getByRole("button", { name: "Suivant" }).click();
  // One question per screen: wait for each one before answering it.
  await expect(page.getByRole("heading", { name: "Qu’allez-vous étudier ?" })).toBeVisible();
  await page.getByLabel("École ou université").fill("IUT de Lyon");
  await page.getByLabel("Formation préparée").fill("BUT Informatique");
  await page.getByRole("radio", { name: /^Bac\+3/ }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByRole("heading", { name: "Que cherchez-vous ?" })).toBeVisible();
  // Alternance is the contract selected by default.
  await expect(page.getByRole("radio", { name: "Une alternance" })).toBeChecked();
  await page.getByRole("button", { name: "Continuer" }).click();

  // The answers are kept without any account, in one cookie.
  await expect(page).toHaveURL(/\/onboarding\/3$/);
  const cookie = (await page.context().cookies()).find(
    (item) => item.name === "candidatly_questionnaire",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(JSON.parse(decodeURIComponent(cookie?.value ?? "{}"))).toMatchObject({
    first_name: "Alex",
    school: "IUT de Lyon",
    diploma_level: "bac+3",
  });

  // Going back to step 2 shows what was answered, still without an account.
  await page.goto("/onboarding/2");
  await expect(page.getByLabel("Prénom")).toHaveValue("Alex");
  // The account screen waits until the questions are answered.
  await page.goto("/onboarding/compte");
  await expect(page).toHaveURL(/\/onboarding\/3$/);
});

test("the answers of a visitor land on the profile created at the end", async ({ page }) => {
  const email = `e2e-visitor-${randomUUID().slice(0, 8)}@example.com`;
  const password = `E2e-${randomUUID()}`;
  await page.context().addCookies([
    {
      name: "candidatly_questionnaire",
      value: JSON.stringify(DRAFT),
      url: "http://localhost:3100",
      httpOnly: true,
    },
  ]);
  const db = adminClient();
  try {
    await page.goto("/onboarding/compte");
    await expect(page.getByRole("heading", { level: 1, name: "Créez votre compte" })).toBeVisible();
    await page.getByLabel("Adresse email").fill(email);
    await page.getByLabel("Mot de passe").fill(password);
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    // Straight to the CV and letter step: the questions are already answered.
    await expect(page).toHaveURL(/\/onboarding\/5$/);
    await expect(page.getByRole("heading", { level: 1, name: /CV/ })).toBeVisible();
    const profile = await db
      .from("profiles")
      .select("first_name, school, rome_codes, location_label, search_radius_km")
      .eq("email", email)
      .single();
    expect(profile.data).toMatchObject({
      first_name: "Alex",
      school: "IUT de Lyon",
      rome_codes: ["M1805"],
      location_label: "Lyon",
      search_radius_km: 30,
    });
    // The cookie is dropped once the answers are on the profile.
    expect(
      (await page.context().cookies()).find((item) => item.name === "candidatly_questionnaire")
        ?.value,
    ).toBeFalsy();
  } finally {
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const user of (data?.users ?? []).filter((u) => u.email === email)) {
      await db.auth.admin.deleteUser(user.id);
    }
  }
});
