import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { adminClient, OFFER_TITLE, STATE_FILE, type E2EState } from "./support";

const BASE_LETTER = [
  "Objet : Candidature pour une alternance",
  "",
  "Madame, Monsieur,",
  "",
  "Étudiante en troisième année de BUT Informatique, je souhaite rejoindre votre équipe pour le poste de [poste] dès la rentrée. Mes projets en TypeScript, React et SQL m’ont appris à livrer des applications utiles et testées. Je travaille avec rigueur et j’aime apprendre de nouveaux outils.",
  "",
  "Au cours de ma formation, j’ai mené plusieurs projets en équipe, dont une application de gestion de bibliothèque et un site vitrine pour une association sportive. Ces expériences m’ont appris à organiser mon travail et à présenter mes choix techniques de façon claire.",
  "",
  "Je vous prie d’agréer, Madame, Monsieur, mes salutations distinguées.",
  "",
  "Camille Testeur",
].join("\n");
const CV_TEXT = "Camille Testeur\nCompétences : TypeScript, React, PostgreSQL, Git";

/** Seeds one offer and two onboarded students; no external API is called by the tested flows. */
export default async function globalSetup() {
  const db = adminClient();
  const run = randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  const offer = await db
    .from("offers")
    .insert({
      source: "api_alternance",
      external_id: `e2e:${run}`,
      title: OFFER_TITLE,
      description: "Nous cherchons un profil React et PostgreSQL pour notre équipe produit.",
      apply_channel: "external_url",
      apply_target: "https://example.org/postuler",
      location_label: "10 RUE DE RIVOLI 75004 PARIS",
      postal_code: "75004",
      lat: 48.8559,
      lng: 2.3589,
      rome_codes: ["M1855"],
      contract_types: ["apprentissage"],
      published_at: now,
      last_seen_at: now,
      raw: {},
    })
    .select("id")
    .single();
  if (offer.error) throw offer.error;

  const users = {} as E2EState["users"];
  for (const role of ["student", "leaver"] as const) {
    const email = `e2e-${role}-${run}@example.com`;
    const created = await db.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw created.error;
    const id = created.data.user.id;
    const profile = await db
      .from("profiles")
      .update({
        first_name: "Camille",
        last_name: "Testeur",
        school: "IUT Lyon 1",
        degree_label: "BUT Informatique",
        diploma_level: "bac+3",
        rome_codes: ["M1855"],
        rome_version: 61,
        location_label: "Paris",
        location_lat: 48.8566,
        location_lng: 2.3522,
        insee_code: "75056",
        search_radius_km: 30,
        onboarding_completed: true,
      })
      .eq("user_id", id);
    if (profile.error) throw profile.error;
    const path = `${id}/cv/${randomUUID()}.pdf`;
    const upload = await db.storage
      .from("documents")
      .upload(path, readFileSync("tests/fixtures/documents/cv.pdf"), {
        contentType: "application/pdf",
      });
    if (upload.error) throw upload.error;
    const documents = await db.from("documents").insert([
      {
        user_id: id,
        kind: "cv",
        storage_path: path,
        original_filename: "cv.pdf",
        mime_type: "application/pdf",
        size_bytes: 682,
        extracted_text: CV_TEXT,
        is_current: true,
      },
      {
        user_id: id,
        kind: "cover_letter_base",
        mime_type: "text/plain",
        size_bytes: BASE_LETTER.length,
        extracted_text: BASE_LETTER,
        is_current: true,
      },
    ]);
    if (documents.error) throw documents.error;
    const match = await db.from("matches").insert({
      user_id: id,
      offer_id: offer.data.id,
      score: 88,
      score_reasons: {
        rome: "exact",
        distanceKm: 0.5,
        diploma: "unspecified",
        freshnessDays: 0,
        keywords: ["react"],
      },
    });
    if (match.error) throw match.error;
    const link = await db.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    users[role] = {
      id,
      email,
      login: `/auth/confirm?type=email&next=/offers&token_hash=${link.data.properties.hashed_token}`,
    };
  }
  const signup = { email: `e2e-signup-${run}@example.com`, password: `E2e-${randomUUID()}` };
  writeFileSync(
    STATE_FILE,
    JSON.stringify({ offerId: offer.data.id, users, signup } satisfies E2EState),
  );
}
