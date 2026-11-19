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
  found_offers: 7,
  found_companies: 12,
  location_label: "Lyon",
  location_lat: 45.758,
  location_lng: 4.835,
  insee_code: "69123",
  search_radius_km: 30,
  // The four answers of the plan (C118).
  situation: "has_school",
  start_timing: "asap",
  weekly_applications: "low",
  main_blocker: "answers",
};

test("a visitor answers the questions with clicks, without an account", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Je n’ai pas mon CV ici/ }).click();
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
  // The cities of the list carry their own coordinates: choosing one calls no service.
  await page.getByRole("button", { name: "Lyon", exact: true }).click();

  // 6. Situation, 7. start, 8. rhythm, then what we do in their place, 9. blocker (C118).
  await expect(page).toHaveURL(/\/onboarding\/6$/);
  await expect(page.getByRole("heading", { name: "Tu en es où ?" })).toBeVisible();
  await page.getByRole("button", { name: /il me manque l’entreprise/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/7$/);
  await page.getByRole("button", { name: /Dès que possible/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/8$/);
  await page.getByRole("button", { name: /^0 à 2/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/gain$/);
  await expect(page.getByText("Un score de correspondance sur chaque offre")).toBeVisible();
  // Nothing on this screen is a statistic or a promised result.
  await expect(page.getByRole("main")).not.toContainText(/%|garanti/);
  await page.getByRole("link", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/onboarding\/9$/);
  // The test stops here: the answer starts the real search of the offers of that city.
  await expect(page.getByRole("button", { name: /On ne me répond pas/ })).toBeVisible();

  // The answers travel in one http-only cookie.
  const cookie = (await page.context().cookies()).find(
    (item) => item.name === "jobgpt_questionnaire",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(JSON.parse(decodeURIComponent(cookie?.value ?? "{}"))).toMatchObject({
    target_contract: "alternance",
    domain_free_text: "Informatique et numérique",
    rome_codes: ["M1855"],
    diploma_level: "bac+3",
    location_label: "Lyon",
    situation: "has_school",
    start_timing: "asap",
    weekly_applications: "low",
  });
});

test("the answers of a visitor land on the profile created at the end", async ({ page }) => {
  const email = `e2e-visitor-${randomUUID().slice(0, 8)}@example.com`;
  const password = `E2e-${randomUUID()}`;
  await page.context().addCookies([
    {
      name: "jobgpt_questionnaire",
      // The server writes the cookie url-encoded, like the browser reads it back.
      value: encodeURIComponent(JSON.stringify(DRAFT)),
      url: "http://localhost:3100",
      httpOnly: true,
    },
  ]);
  const db = adminClient();
  // The end of the questionnaire runs the first search, which calls the offers API: the
  // test stops at its door.
  await page.route("**/onboarding/fin", (route) =>
    route.fulfill({ status: 200, contentType: "text/plain", body: "fin" }),
  );
  try {
    await page.goto("/onboarding/compte");
    await expect(page.getByRole("heading", { level: 1, name: "Crée ton compte" })).toBeVisible();
    // The promise of the analysis stays on screen, without a figure (C94).
    await expect(page.getByText(/Tes offres t’attendent/)).toBeVisible();
    await page.getByLabel("Prénom").fill("Alex");
    await page.getByLabel("Nom", { exact: true }).fill("Visiteur");
    await page.getByLabel("Adresse email").fill(email);
    await page.getByLabel("Mot de passe").fill(password);
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    // Straight to the end: everything is answered, the CV is not asked again (C111).
    await expect(page).toHaveURL(/\/onboarding\/fin$/);
    const profile = await db
      .from("profiles")
      .select(
        "first_name, last_name, target_contract, domain_free_text, rome_codes, diploma_level, location_label, search_radius_km, situation, start_timing, weekly_applications, main_blocker",
      )
      .eq("email", email)
      .single();
    expect(profile.data).toMatchObject({
      situation: "has_school",
      start_timing: "asap",
      weekly_applications: "low",
      main_blocker: "answers",
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
      (await page.context().cookies()).find((item) => item.name === "jobgpt_questionnaire")?.value,
    ).toBeFalsy();
  } finally {
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const user of (data?.users ?? []).filter((u) => u.email === email)) {
      await db.auth.admin.deleteUser(user.id);
    }
  }
});

test("a CV dropped on the landing page fills the questionnaire", async ({ page }) => {
  // The analysis screen would call the offers API: the test stops right after the scan.
  await page.route("**/onboarding/analyse**", (route) => route.abort());
  await page.goto("/");
  // The scan reads the file on the server and keeps only the answers it suggests (C95).
  await page.setInputFiles('input[type="file"]', "tests/fixtures/documents/cv-alternance.pdf");
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).find((item) => item.name === "jobgpt_questionnaire")
          ?.value,
      { timeout: 30_000 },
    )
    .toBeTruthy();
  const cookie = (await page.context().cookies()).find(
    (item) => item.name === "jobgpt_questionnaire",
  );
  const draft = JSON.parse(decodeURIComponent(cookie?.value ?? "{}"));
  // What the CV of Camille Durand says: apprenticeship, Bac+3, web developer, Lyon.
  expect(draft).toMatchObject({
    target_contract: "alternance",
    diploma_level: "bac+3",
    domain_free_text: "Informatique et numérique",
    insee_code: "69123",
    scan_summary: "Bac+3 · Informatique et numérique · Lyon",
  });
  expect(draft.rome_codes).toContain("M1855");
  // The name and the address fill the sign-up form (C97); the rest of the CV is dropped.
  expect(draft).toMatchObject({
    first_name: "Camille",
    last_name: "Durand",
    scan_email: "camille.durand@example.com",
  });
  const stored = JSON.stringify(draft);
  expect(stored).not.toContain("Atelier");
  expect(stored).not.toContain("06 12 34 56 78");

  // A CV replaces the five questions by one screen to confirm (C100).
  await expect(page).toHaveURL(/\/onboarding\/profil$/);
  await expect(page.getByRole("heading", { name: "On a lu ton CV." })).toBeVisible();
  await expect(page.getByLabel("Ton domaine")).toHaveValue("informatique");
  await expect(page.getByRole("radio", { name: "Bac+3" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Alternance" })).toBeChecked();
  await expect(page.getByText("Lyon", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Voir mes offres" })).toBeVisible();

  // The CV answers what to search, not the questions of the plan: they are added here the
  // way the four clicks would, so the account screen can open (C118).
  await page.context().addCookies([
    {
      name: "jobgpt_questionnaire",
      value: encodeURIComponent(
        JSON.stringify({
          ...draft,
          situation: "has_school",
          start_timing: "asap",
          weekly_applications: "low",
          main_blocker: "answers",
        }),
      ),
      url: "http://localhost:3100",
      httpOnly: true,
    },
  ]);
  // The account screen opens with what the CV gave.
  await page.goto("/onboarding/compte");
  await expect(page.getByLabel("Prénom")).toHaveValue("Camille");
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue("Durand");
  await expect(page.getByLabel("Adresse email")).toHaveValue("camille.durand@example.com");
});
