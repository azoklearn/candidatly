import { expect, test } from "@playwright/test";

import { adminClient, loadState, OFFER_TITLE, SCHOOL_OFFER_TITLE } from "./support";

test("a student prepares, sends and tracks an application, then exports their data", async ({
  page,
}) => {
  const { users } = loadState();
  await page.goto(users.student.login);
  await expect(page).toHaveURL(/\/offers$/);

  // The dashboard, home of the paid area (C124): figures, next steps, every feature.
  await page.getByRole("link", { name: "Accueil", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Bonjour Camille" })).toBeVisible();
  // The school offer is hidden in the list, so it is not counted here either.
  await expect(page.getByRole("link", { name: /^1\s*Offre à découvrir/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^0\s*Candidature à envoyer/ })).toBeVisible();
  const best = page.getByRole("region", { name: "Vos meilleures offres" });
  await expect(best.getByText(OFFER_TITLE)).toBeVisible();
  await expect(page.getByText(SCHOOL_OFFER_TITLE)).toHaveCount(0);
  const search = page.getByRole("region", { name: "Votre recherche" });
  await expect(search.getByText("Paris · 30 km autour")).toBeVisible();
  await expect(search.getByText("Bac+3")).toBeVisible();
  const todo = page.getByRole("region", { name: "À faire maintenant" });
  await expect(todo.getByText("1 offre à découvrir")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Entreprises à contacter" })
      .getByText(/test E2E/)
      .first(),
  ).toBeVisible();
  const features = page.getByRole("region", { name: "Tout ce que vous pouvez faire" });
  const night = features.getByRole("listitem").filter({ hasText: "Préparation de nuit" });
  await expect(night.getByText("Désactivée")).toBeVisible();
  await expect(
    features.getByRole("listitem").filter({ hasText: "Filtre anti-bruit" }).getByText("Activé"),
  ).toBeVisible();
  await features.getByRole("link", { name: /Offres triées pour vous/ }).click();
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

  // The offer managed by a school is hidden until the student asks for it (C120).
  await expect(page.getByText(SCHOOL_OFFER_TITLE)).toHaveCount(0);
  await expect(page.getByText(/1 offre masquée/)).toBeVisible();
  await page.getByRole("button", { name: "Les afficher" }).click();
  const school = page.getByRole("listitem").filter({ hasText: SCHOOL_OFFER_TITLE });
  await expect(school.getByText("Offre gérée par une école")).toBeVisible();
  await page.getByRole("button", { name: "Les masquer" }).click();
  await expect(page.getByText(SCHOOL_OFFER_TITLE)).toHaveCount(0);

  // The same offers one at a time: keep it with a button, as a swipe to the right would.
  await page.getByRole("link", { name: "Une par une" }).click();
  await expect(page).toHaveURL(/mode=swipe/);
  await expect(page.getByRole("heading", { level: 2, name: OFFER_TITLE })).toBeVisible();
  await expect(page.getByText("Votre métier", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Garder cette offre" }).click();
  await expect(page.getByText("1 offre gardée sur 1")).toBeVisible();
  await page.getByRole("link", { name: "Liste", exact: true }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: OFFER_TITLE }).getByText("Enregistrée"),
  ).toBeVisible();

  await page.getByRole("link", { name: OFFER_TITLE }).click();
  // What fits, what is missing, and advice: rules on the reasons of the score (C120).
  await expect(page.getByText("Analyse du match")).toBeVisible();
  await expect(page.getByText("Le métier est l’un de ceux que vous visez.")).toBeVisible();
  await expect(
    page.getByText("L’offre ne dit pas quel niveau de diplôme elle vise."),
  ).toBeVisible();
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

  // A company of the selection that published no offer: its page says that being listed
  // promises nothing, and prepares an unsolicited application (C121).
  await page
    .getByRole("listitem")
    .filter({ hasText: "Atelier numérique 2 (test E2E)" })
    .getByRole("link", { name: "Fiche et candidature" })
    .click();
  await expect(page).toHaveURL(/\/companies\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/Être listée ne garantit pas qu’un poste est ouvert/)).toBeVisible();
  await page.getByRole("button", { name: "Préparer ma candidature spontanée" }).click();
  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/Candidature spontanée · Atelier numérique 2/)).toBeVisible();
  // The trade of the profile fills [poste]; nothing is invented about the company.
  await expect(page.locator("mark").first()).toBeVisible();
  await expect(page.getByText(/Vous envoyez vous-même votre candidature spontanée/)).toBeVisible();
  await page.goto("/applications");
  await expect(page.getByRole("link", { name: "Candidature spontanée" })).toBeVisible();

  // The page shown after the questionnaire: the result in words, then one button (C105).
  await page.goto("/forfait");
  // No figure before the plan is active (C104).
  await expect(page.getByRole("heading", { level: 1 })).toContainText("une offre");
  await expect(page.getByRole("heading", { level: 1 })).not.toContainText(/\d/);
  // The freshness comes from the student's own matches, never invented.
  await expect(page.getByText(/de ta sélection a été publiée ces 7 derniers jours/)).toBeVisible();
  // The plan comes from the student's own answers: a goal, a rhythm, where we start (C118).
  const plan = page.getByRole("region", { name: "Ton plan" });
  await expect(plan.getByText("Trouver un contrat le plus vite possible")).toBeVisible();
  await expect(plan.getByText("Commence par 5 candidatures par semaine")).toBeVisible();
  await expect(plan.getByText("On commence par ta lettre")).toBeVisible();
  // Nothing else on this page: the plans live behind the button.
  await expect(page.getByText("Recommandé")).toHaveCount(0);
  await page.getByRole("link", { name: "Découvrir les offres" }).click();
  await expect(page).toHaveURL(/\/forfait\/choisir$/);

  await expect(page.getByRole("heading", { level: 1, name: "Choisis ton forfait" })).toBeVisible();
  await expect(page.getByText("Recommandé")).toBeVisible();
  // The preview shows the city but never the job title, not even in the HTML (C88).
  await expect(page.getByText("Tes offres attendent derrière le flou")).toBeVisible();
  expect(await page.content()).not.toContain(OFFER_TITLE);
  // The recap comes from the student's own profile.
  const recap = page.getByRole("region", { name: "Ce qu’on a retenu de ta recherche" });
  await expect(recap.getByText("Paris", { exact: true })).toBeVisible();
  await expect(recap.getByText("jusqu’à 30 km")).toBeVisible();
  await expect(recap.getByText("Bac+3")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Ce qu’on tient, noir sur blanc/ })).toBeVisible();
  await expect(page.getByText("Je peux arrêter quand je veux ?")).toBeVisible();
  await page.getByRole("button", { name: "Choisir 3 mois" }).click();
  // A chosen plan opens the dashboard, the home of the paid area (C124).
  await expect(page).toHaveURL(/\/dashboard$/);

  const response = await page.request.get("/api/account/export");
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.profile.first_name).toBe("Camille");
  expect(data.profile.chosen_plan).toBe("plus");
  // Each plan has its own billing: 3 mois renews every three months (C113).
  expect(data.profile.chosen_billing).toBe("quarterly");
  // The application to the offer, and the unsolicited one to the company (C121).
  expect(data.applications).toHaveLength(2);
  const statuses = data.applications.map((item: { status: string }) => item.status).sort();
  expect(statuses).toEqual(["draft", "replied_positive"]);
  const spontaneous = data.applications.find((item: { offer: unknown }) => item.offer === null);
  expect(spontaneous.company_name).toBe("Atelier numérique 2 (test E2E)");
});

test("a student looking for an internship gets the companies of their domain (C106)", async ({
  page,
}) => {
  const { users } = loadState();
  const db = adminClient();
  const set = (target_contract: "stage" | "alternance") =>
    db.from("profiles").update({ target_contract }).eq("user_id", users.student.id);
  expect((await set("stage")).error).toBeNull();
  try {
    // The seeded link was spent by the test above: a fresh one for this session.
    const link = await db.auth.admin.generateLink({
      type: "magiclink",
      email: users.student.email,
    });
    expect(link.error).toBeNull();
    await page.goto(
      `/auth/confirm?type=email&next=/offers&token_hash=${link.data.properties?.hashed_token}`,
    );
    await expect(page.getByRole("heading", { level: 1, name: "Vos entreprises" })).toBeVisible();
    // No work-study offer and no claim about hiring apprentices: companies of the domain.
    await expect(page.getByText(OFFER_TITLE)).toHaveCount(0);
    const seeded = page.getByRole("listitem").filter({ hasText: "Atelier numérique 1 (test E2E)" });
    await expect(seeded.getByText("Dans vos métiers")).toBeVisible();
    await expect(seeded.getByRole("link", { name: /Voir l’entreprise/ })).toHaveAttribute(
      "href",
      "https://annuaire-entreprises.data.gouv.fr/etablissement/12345678900012",
    );
    await expect(seeded.getByRole("link", { name: /candidature spontanée/ })).toHaveCount(0);
    // Nothing on the page says where the data comes from.
    expect(await page.content()).not.toMatch(/La bonne alternance|API Alternance/);

    await page.goto("/forfait");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "de ton domaine près de chez toi",
    );
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText(/\d|offre/);
    await expect(page.getByText(/7 derniers jours/)).toHaveCount(0);
    await page.getByRole("link", { name: "Découvrir les entreprises" }).click();
    await expect(page).toHaveURL(/\/forfait\/choisir$/);
    await expect(page.getByText("Tes offres attendent derrière le flou")).toHaveCount(0);
  } finally {
    await set("alternance");
  }
});
