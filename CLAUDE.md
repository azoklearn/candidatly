# CLAUDE.md (Candidatly)

Nom de code provisoire : `candidatly`. Ce fichier est la mémoire de travail du projet : résumé, stack, conventions, commandes. Il est mis à jour à la fin de chaque phase. Le brief d'origine est dans `docs/BRIEF.md` (ne pas modifier) ; les écarts par rapport au brief et les décisions sont tracés dans `docs/QUESTIONS.md` et dans la section « Journal des décisions » ci-dessous.

## 1. Le projet en trois lignes

SaaS pour étudiants français : trouve les offres d'alternance publiées qui correspondent au profil (ROME, niveau, zone), construit une fiche employeur, adapte la lettre de motivation de l'étudiant à chaque offre sans inventer de faits, envoie la candidature après validation explicite, puis suit les réponses et propose les relances. Monétisation en cours de redéfinition : le brief prévoyait des packs de crédits sans abonnement ; depuis le 10 septembre 2026, l'envoi des candidatures est prévu dans un abonnement premium (questions A3 à A5 de `docs/QUESTIONS.md`).

Principes non négociables : validation humaine avant chaque envoi, aucun fait inventé par le LLM, aucun scraping de job boards, RGPD (données minimales, suppression réelle, fichiers privés chiffrés au repos).

## 2. État d'avancement

| Phase | Contenu | État |
|---|---|---|
| 0 | Cadrage, lecture des API, questions ouvertes, ce fichier | Livrée, en attente de validation |
| 1 | Init Next.js, Supabase (migrations, RLS, bucket), auth, `OfferProvider` + tests | À faire |
| 2 | Onboarding 6 étapes, mapping ROME, extraction CV/lettre, jobs `sync-offers` / `compute-matches`, écrans offres | À faire |
| 3 | `enrich-company`, résumé entreprise, génération de lettre + diff | À faire |
| 4 | Envoi API Alternance, suivi, Stripe + ledger, compte / export / suppression, Playwright | À faire |
| 5 | Landing, légal, rate limiting, Sentry, coûts LLM, `docs/RUNBOOK.md` | À faire |

## 3. Stack

- **Next.js 16** App Router, TypeScript `strict`, Turbopack. Le fichier de session s'appelle `proxy.ts` (runtime Node.js), pas `middleware.ts`.
- **Tailwind CSS 4** (configuration en CSS, pas de `tailwind.config.js`) et **shadcn/ui** (CLI `shadcn`, style `new-york`, variables CSS).
- **Supabase** : Auth (email + Google, flux PKCE), Postgres avec RLS sur toutes les tables, Storage bucket privé `documents`. Clés « publishable » et « secret » (les clés `anon` / `service_role` sont dépréciées fin 2026).
- **Trigger.dev v4** pour les jobs asynchrones et planifiés. La v3 imposée par le brief est retirée ; la v4 n'a pas besoin de route `/api/trigger` (écart documenté dans `docs/QUESTIONS.md`).
- **Anthropic SDK** `@anthropic-ai/sdk` : `claude-sonnet-5` (lettres), `claude-haiku-4-5-20251001` (ROME, résumé entreprise, extraction). Sorties JSON par « structured outputs » (`client.messages.parse` + `zodOutputFormat`).
- **Stripe** Checkout + webhooks (`checkout.session.completed` et `checkout.session.async_payment_succeeded`) ; abonnements par Stripe Billing si l'abonnement premium est confirmé (A5).
- **Zod 4** à toutes les frontières (formulaires, réponses API externes, sorties JSON LLM).
- **Vitest 5** (unitaires), **Playwright** (2 à 3 parcours critiques).
- Déploiement : Vercel (Node 24) + Supabase cloud (région UE) + Trigger.dev cloud (`runtime: "node-24"`).
- Pas d'ORM : client Supabase typé, types générés par `supabase gen types`.

Versions exactes : section 8.

## 4. Sources de données externes

| Source | Usage | Doc interne |
|---|---|---|
| API Alternance (`api.apprentissage.beta.gouv.fr/api`) | Recherche d'offres (`GET /job/v1/search`), détail (`GET /job/v1/offer/{id}`), candidature (`POST /job/v1/apply`) | `docs/API_ALTERNANCE.md` |
| API Recherche d'entreprises (`recherche-entreprises.api.gouv.fr`) | Fiche entreprise (SIREN, NAF, effectifs, siège, dirigeants) | `docs/API_RECHERCHE_ENTREPRISES.md` |
| Géocodage BAN (Géoplateforme IGN `data.geopf.fr/geocodage`, ex `api-adresse.data.gouv.fr`) | Autocomplétion d'adresse, lat/lng, code INSEE | `docs/API_ADRESSE.md` |
| Nomenclature ROME (France Travail, open data) | Liste officielle des codes pour valider le mapping LLM | `docs/ROME.md` |
| Site web de l'entreprise | Page d'accueil + page « à propos », texte utile max 6 000 caractères | `docs/BRIEF.md` §3.3 |

Fichiers de référence bruts (spécifications OpenAPI, échantillons de réponses réelles, libellés NAF) : `docs/reference/`.

Règles : tout appel externe passe par `/lib` avec schéma Zod sur la réponse, timeout, erreur typée. Respect de `robots.txt`, user-agent identifiable, 1 requête max par domaine toutes les 2 s, timeout 8 s pour les sites d'entreprise.

Points structurants confirmés en phase 0 (détails dans `docs/API_ALTERNANCE.md`) :
- Les pages officielles de l'API la réservent « à des usages non lucratifs » et interdisent « la facturation de l'accès pour des tiers comme des candidats ». L'owner a décidé le 10 septembre 2026 de ne pas solliciter le support : risque accepté, tracé dans `docs/QUESTIONS.md` (A1). Sans habilitation, la route de candidature reste fermée en production.
- Le type de jeton porte l'environnement : un jeton **sandbox** envoie tous les échanges, lectures comprises, vers l'environnement de test de La bonne alternance ; un jeton **production**, créé librement sur le portail, donne les offres réelles. L'habilitation `applications:write` en production se demande par email au support. Variables : `API_ALTERNANCE_KEY` (production) et `API_ALTERNANCE_SANDBOX_KEY` (tests d'envoi).
- Une offre n'est candidatable par l'API que si `apply.recipient_id` est non nul ; les offres France Travail ne le sont en pratique pas (URL externe seulement). D'où le canal `external_url` du brief.
- La recherche renvoie au plus 150 offres par source, sans pagination. `identifier.id` peut être nul (offres France Travail selon la spécification) : la clé externe est `partner_label` + `partner_job_id`.
- Limites : 60 recherches/min, 120 détails/min, 10 candidatures/min par clé ; côté La bonne alternance, 20 candidatures par jour et par SIRET pour une même organisation consommatrice, 3 par candidat et par offre. Pas d'idempotence sur la candidature : ne jamais rejouer un envoi accepté.
- Mesure du 10 septembre 2026 avec le jeton production : 46 % des offres ont un `recipient_id` ; aucune offre ne contient d'adresse email ; le site web n'est connu que pour 7 % des offres ; 38 % des offres sont gérées par une école (`is_delegated`). Détail dans `docs/API_ALTERNANCE.md`, section 0.

## 5. Arborescence cible

```
/app
  /(marketing)     landing, tarifs, mentions légales, confidentialité
  /(auth)          login, signup, auth/callback
  /(app)           onboarding/[step], offers (+ [id]), applications, credits, account
  /api             stripe/webhook, geocode (proxy serveur vers le géocodage)
proxy.ts           rafraîchissement de session Supabase (updateSession + getClaims)
/components        UI (shadcn dans /components/ui)
/lib
  /supabase        clients browser / server / admin (clé secret), proxy.ts, database.types.ts
  /providers       OfferProvider (interface) + api-alternance.ts, adzuna.ts (stub V2)
  /enrichment      recherche-entreprises.ts, website-fetch.ts
  /ai              client anthropic, cover-letter.ts, company-summary.ts, rome-mapping.ts
  /geocoding       geocode.ts (Géoplateforme)
  /matching        score.ts
  /credits         ledger.ts
  /documents       extract-text.ts (pdf, docx)
  logger.ts, errors.ts, env.ts
/trigger           jobs Trigger.dev + trigger.config.ts à la racine
/supabase          migrations/, seed.sql, config.toml
/scripts           import-rome.ts (import de la nomenclature ROME)
/tests             unit/, e2e/, fixtures/ (réponses API réelles tronquées)
/docs              BRIEF.md, UNDERSTANDING.md, QUESTIONS.md, API_*.md, ROME.md, reference/
```

## 6. Conventions

### Langue
- Textes UI en français (accents corrects, vouvoiement). Code, commentaires, messages de commit en anglais.
- Pas de tirets cadratins dans les textes générés ni dans la doc.

### Nommage
- Fichiers et dossiers : `kebab-case.ts`. Composants React : `PascalCase` dans des fichiers `kebab-case.tsx`.
- Fonctions et variables : `camelCase`. Types et schémas Zod : `PascalCase` (`OfferSchema`, `type Offer = z.infer<typeof OfferSchema>`).
- Tables et colonnes Postgres : `snake_case`, enums Postgres nommés `<table>_<colonne>` (ex. `applications_status`).
- Variables d'environnement : `SCREAMING_SNAKE_CASE`, préfixe `NEXT_PUBLIC_` uniquement pour ce qui est réellement public (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).

### Gestion des erreurs
- `lib/errors.ts` définit `AppError` (`code`, `message`, `cause`, `retryable`) et ses sous-classes : `ExternalApiError` (source, status, body tronqué), `ValidationError` (issues Zod), `InsufficientCreditsError`, `NotFoundError`, `RateLimitedError`.
- Les fonctions de `/lib` lancent des erreurs typées, jamais de chaînes. Les frontières (route handlers, server actions, jobs) attrapent, loguent et traduisent en réponse utilisateur en français.
- Chaque appel externe : `AbortSignal.timeout(ms)`, validation Zod de la réponse (`safeParse` ; l'échec devient une `ExternalApiError` avec le chemin Zod dans les logs), jamais de secret ni de PII dans le message d'erreur.
- Codes de quota : traiter 429 (et tolérer 419, coquille de la spec API Alternance) avec backoff exponentiel et respect de `retry-after`.
- Sorties LLM : JSON strict via structured outputs, validé par Zod ; une seule régénération automatique en cas d'échec de validation ou de post-traitement, puis erreur explicite à l'utilisateur.

### Appels Anthropic
- Toujours `client.messages.parse` avec `output_config.format = zodOutputFormat(Schema)` ; jamais de JSON extrait d'un texte libre.
- `claude-sonnet-5` refuse `temperature` (400) : pas de paramètre de température, `thinking: { type: "disabled" }` pour la lettre (décision par défaut, voir `docs/QUESTIONS.md`), consignes de sobriété dans le system prompt.
- `claude-haiku-4-5-20251001` : pas de paramètre `effort` ; `temperature` accepté sans thinking.
- Identifiants de modèle lus depuis `lib/env.ts` (`ANTHROPIC_MODEL_LETTER`, `ANTHROPIC_MODEL_LIGHT`) pour changer de modèle sans redéploiement de code.
- Tokens d'entrée et de sortie loggés et stockés (`applications.generation_tokens`).

### Secrets et configuration
- `lib/env.ts` valide toutes les variables avec Zod au démarrage (serveur) et exporte un objet typé. Aucun `process.env` ailleurs.
- `.env.local` jamais commité ; `.env.example` tenu à jour à chaque nouvelle variable.
- Aucune clé côté client : appels LLM et API externes uniquement côté serveur (server actions, route handlers) ou dans les jobs Trigger.dev. Le géocodage passe par `app/api/geocode` même si l'API est publique.
- En production : variables dans Vercel (app) et dans le dashboard Trigger.dev (jobs, ou extension `syncVercelEnvVars`). `SUPABASE_SECRET_KEY` n'est utilisée que dans les jobs et le webhook Stripe.
- Les jetons de l'API Alternance expirent au bout de 365 jours : date d'expiration notée dans `docs/RUNBOOK.md` à la création.

### Logs
- `lib/logger.ts` : logger structuré JSON (`debug`, `info`, `warn`, `error`) avec champs `job`, `userId`, `offerId` selon le contexte. Pas de `console.log` ailleurs. Dans les jobs, le wrapper délègue au `logger` de Trigger.dev.
- Jamais de secret, de contenu de CV ni de lettre complète dans les logs.

### Base de données et crédits
- Toutes les tables : `id uuid default gen_random_uuid()`, `created_at`, `updated_at` (trigger), RLS activée, politiques par `user_id = auth.uid()`. Storage : politiques sur `storage.objects` limitées au dossier `<user_id>/` du bucket `documents`.
- Les jobs et webhooks utilisent le client `service_role` (bypass RLS) et filtrent explicitement par `user_id`.
- Toute opération sur les crédits passe par une fonction Postgres transactionnelle (`debit_credit`, `credit_purchase`) idempotente grâce à une contrainte unique sur la référence (`application_id`, `stripe_checkout_session_id`). Les `event.id` Stripe traités sont stockés pour dédupliquer les webhooks.
- `offers.external_id` = `<partner_label>:<partner_job_id>` (source `api_alternance`).
- Migrations SQL dans `supabase/migrations`, types régénérés après chaque migration.

### Jobs Trigger.dev
- Un fichier par job dans `/trigger`, `import { task, schedules } from "@trigger.dev/sdk"`, `schemaTask` avec Zod pour les payloads.
- Idempotence : `idempotencyKey` explicite au déclenchement ; retry avec backoff (config globale `maxAttempts: 3`), `AbortTaskRunError` pour les erreurs non rejouables (400 métier, crédit insuffisant).
- `send-application` : jamais de rejeu automatique après un 202 ou un timeout ; l'incertitude est remontée à l'utilisateur.
- Les jobs ne contiennent pas de logique métier : ils orchestrent des fonctions de `/lib` testables unitairement.

### Tests
- Vitest : `tests/unit/**/*.test.ts` et tests colocalisés `*.test.ts` autorisés dans `/lib`. Réponses API mockées depuis `tests/fixtures/` (JSON réels tronqués et anonymisés, issus de `docs/reference/`).
- Playwright : `tests/e2e/`, parcours onboarding, préparation + envoi (mode mock), achat de crédits (Stripe test), contre `next build && next start` et la stack Supabase locale (Docker).
- Aucun test ne doit appeler une API externe réelle ni un LLM réel ; les clients acceptent une injection de `fetch` pour le mock.

### Git
- Commits atomiques, messages en anglais au format conventionnel : `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Une fonctionnalité = une branche courte, merge en fast-forward ou squash.

### Librairies hors stack
- Avant d'ajouter une librairie non listée dans le brief : justification en une phrase dans `docs/QUESTIONS.md` et accord de l'owner. Demandes en cours : `unpdf` (PDF) et `mammoth` (DOCX).

## 7. Commandes utiles

```bash
# Développement
npm run dev                                  # Next.js (Turbopack)
npx trigger.dev@latest dev                   # jobs Trigger.dev en local (à partir de la phase 2)
npx supabase start                           # Postgres + Auth + Storage locaux (Docker requis)
npx supabase db reset                        # rejoue migrations + seed.sql
npx supabase gen types typescript --local > lib/supabase/database.types.ts
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Qualité
npm run lint                                 # eslint (flat config)
npm run typecheck                            # tsc --noEmit
npm run test                                 # Vitest
npm run test:e2e                             # Playwright
npm run format                               # Prettier

# Déploiement
npx trigger.dev@latest deploy
npx next upgrade                             # met à jour Next.js et sa doc embarquée
```

Les scripts npm exacts sont créés en phase 1 ; cette liste est mise à jour avec eux.

## 8. Versions

Vérifiées le 9 septembre 2026 sur le registre npm et la documentation officielle (détail et sources dans `docs/QUESTIONS.md`, section « Versions et écarts de stack »).

| Composant | Version cible | Note |
|---|---|---|
| Node.js | 24.x | Défaut Vercel, requis par supabase-js (>= 22) et Vitest 5 (>= 22.12) |
| next | 16.3.x | `proxy.ts`, API de requête asynchrones, Turbopack, plus de `next lint` |
| react / react-dom | 19.2.x | |
| typescript | 6.0.x | typescript-eslint n'accepte pas encore TS 7 (voir questions) |
| tailwindcss / @tailwindcss/postcss | 4.3.x | |
| shadcn (CLI) | 4.x | Base UI par défaut depuis juillet 2026 |
| @supabase/supabase-js / @supabase/ssr / supabase (CLI) | 2.116.x / 0.12.x / 2.117.x | v3 de supabase-js en préparation, rester en 2.x |
| @trigger.dev/sdk | 4.5.x | v3 retirée |
| @anthropic-ai/sdk | 0.124.x | structured outputs GA, `zodOutputFormat` |
| stripe | 22.6.x | API `2026-08-26.dahlia`, `new Stripe()` |
| zod | 4.5.x | API v4 (`z.email()`, `error:`) |
| vitest / @vitest/coverage-v8 | 5.0.x | |
| @playwright/test | 1.63.x | |
| eslint / eslint-config-next / prettier | 10.x / 16.3.x / 3.9.x | flat config |
| unpdf / mammoth (sous réserve d'accord) | 1.8.x / 1.12.x | extraction PDF / DOCX sans binaire natif |

Modèles Anthropic : `claude-sonnet-5` (contexte 1M, sortie max 128K, 2 $ / 10 $ par MTok, retrait pas avant le 30 juin 2027) ; `claude-haiku-4-5-20251001` (200K / 64K, 1 $ / 5 $ par MTok, retrait possible à partir du 15 octobre 2026).

## 9. Journal des décisions

- 2026-09-08 : phase 0 démarrée. Brief archivé dans `docs/BRIEF.md`. Docs API produites à partir de la documentation officielle et des spécifications OpenAPI sauvegardées dans `docs/reference/`, avec vérification croisée ; toute affirmation non confirmée est marquée « ⚠️ Non vérifié » dans les docs.
- 2026-09-09 : écarts de stack constatés et proposés par défaut (Trigger.dev v4, `proxy.ts`, clés Supabase publishable/secret, Zod 4, pas de température sur Sonnet 5, géocodage sur la Géoplateforme). Deux questions bloquantes posées à l'owner : compatibilité du modèle payant avec les conditions de l'API Alternance (clause « usage non lucratif » confirmée sur les pages officielles) et obtention de l'habilitation de production ; canal de candidature pour les offres sans `recipient_id`. Détail dans `docs/QUESTIONS.md`.
- 2026-09-10 : docs de référence finalisées et relues (`docs/API_ALTERNANCE.md`, `docs/API_RECHERCHE_ENTREPRISES.md`, `docs/API_ADRESSE.md`, `docs/ROME.md`). Écarts de schéma par rapport au brief regroupés dans `docs/QUESTIONS.md` (C42 à C47). La question A1 bloque la phase 2, pas la phase 1. Un jeton sandbox renvoie des données de test même en lecture : jeton production pour la lecture, jeton sandbox pour tester l'envoi.
- 2026-09-10 : l'owner décide que l'envoi des candidatures sera une fonctionnalité d'un abonnement premium, par un email ouvert dans la boîte de l'étudiant. Les mesures sur données réelles montrent qu'aucune source autorisée ne fournit l'adresse du recruteur : questions A3 à A5 ajoutées et email au support réécrit. Jeton production rangé dans `.env.local`, échéance le 10 septembre 2027 (`docs/RUNBOOK.md`).
- 2026-09-10 : l'owner décide de ne pas contacter le support de l'API Alternance. A1 est close, le risque est accepté ; faute d'habilitation, l'envoi passe par le widget `/postuler`, le site du partenaire ou un email quand l'adresse est connue.
