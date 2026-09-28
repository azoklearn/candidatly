import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { adminClient } from "./support";

/**
 * The questionnaire is answered with clicks, before the account exists
 * (docs/QUESTIONS.md C91 and C92).
 */

const DRAFT = {
  target_contract: "alternance",
  contract_chosen_at: "2026-09-28T09:00:00Z",
  domain_free_text: "Informatique et numérique",
  rome_codes: ["M1805"],
  rome_version: 61,
  diploma_level: "bac+3",
  location_label: "Lyon",
  location_lat: 45.758,
  location_lng: 4.835,
  insee_code: "69123",
  search_radius_km: 30,
};

test("a visitor answers the questions with clicks, without an account", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Décrocher mon alternance" }).click();
  await expect(page).toHaveURL(/\/onboarding\/1$/);

  // 1. Contract, 2. domain, 3. jobs, 4. level, 5. city: one click each.
  await page.getByRole("button", { name: /Une alternance/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/2$/);
  await page.getByRole("button", { name: /Informatique et numérique/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/3$/);
  await page.getByRole("checkbox", { name: /Développeur \/ Développeuse web/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/onboarding\/4$/);
  await page.getByRole("button", { name: /^Bac\+3/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/5$/);
  // Choosing a city of the list calls no address service.
  await page.getByRole("button", { name: "Lyon", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/compte$/);

  // The answers travel in one http-only cookie.
  const cookie = (await page.context().cookies()).find(
    (item) => item.name === "candidatly_questionnaire",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(JSON.parse(decodeURIComponent(cookie?.value ?? "{}"))).toMatchObject({
    target_contract: "alternance",
    domain_free_text: "Informatique et numérique",
    rome_codes: ["M1855"],
    diploma_level: "bac+3",
    location_label: "Lyon",
    insee_code: "69123",
  });
});

test("the answers of a visitor land on the profile created at the end", async ({ page }) => {
  const email = `e2e-visitor-${randomUUID().slice(0, 8)}@example.com`;
  const password = `E2e-${randomUUID()}`;
  await page.context().addCookies([
    {
      name: "candidatly_questionnaire",
      // The server writes the cookie url-encoded, like the browser reads it back.
      value: encodeURIComponent(JSON.stringify(DRAFT)),
      url: "http://localhost:3100",
      httpOnly: true,
    },
  ]);
  const db = adminClient();
  try {
    await page.goto("/onboarding/compte");
    await expect(page.getByRole("heading", { level: 1, name: "Créez votre compte" })).toBeVisible();
    await page.getByLabel("Prénom").fill("Alex");
    await page.getByLabel("Nom", { exact: true }).fill("Visiteur");
    await page.getByLabel("Adresse email").fill(email);
    await page.getByLabel("Mot de passe").fill(password);
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    // Straight to the CV and letter step: everything else is answered.
    await expect(page).toHaveURL(/\/onboarding\/7$/);
    const profile = await db
      .from("profiles")
      .select(
        "first_name, last_name, target_contract, domain_free_text, rome_codes, diploma_level, location_label, search_radius_km",
      )
      .eq("email", email)
      .single();
    expect(profile.data).toMatchObject({
      first_name: "Alex",
      last_name: "Visiteur",
      target_contract: "alternance",
      domain_free_text: "Informatique et numérique",
      rome_codes: ["M1805"],
      diploma_level: "bac+3",
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
