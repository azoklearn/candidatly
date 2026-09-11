# CLAUDE.md (Candidatly)

@AGENTS.md

Nom de code provisoire : `candidatly`. Ce fichier est la mémoire de travail du projet : résumé, stack, conventions, commandes. Il est mis à jour à la fin de chaque phase. Le brief d'origine est dans `docs/BRIEF.md` (ne pas modifier) ; les écarts par rapport au brief et les décisions sont tracés dans `docs/QUESTIONS.md` et dans le journal ci-dessous. `AGENTS.md` est géré par Next.js (`next dev` le réécrit) : il rappelle de lire la documentation embarquée dans `node_modules/next/dist/docs/` avant d'écrire du code Next.js.

## 1. Le projet en trois lignes

SaaS pour étudiants français : trouve les offres d'alternance publiées qui correspondent au profil (ROME, niveau, zone), construit une fiche employeur, adapte la lettre de motivation de l'étudiant à chaque offre sans inventer de faits, aide à envoyer la candidature après validation explicite, puis suit les réponses et propose les relances. Monétisation en cours de redéfinition : le brief prévoyait des packs de crédits sans abonnement ; depuis le 10 septembre 2026, l'envoi des candidatures est prévu dans un abonnement premium (questions A3 à A5 de `docs/QUESTIONS.md`).

Principes non négociables : validation humaine avant chaque envoi, aucun fait inventé par le LLM, aucun scraping de job boards, RGPD (données minimales, suppression réelle, fichiers privés chiffrés au repos).

## 2. État d'avancement

| Phase | Contenu | État |
|---|---|---|
| 0 | Cadrage, lecture des API, questions ouvertes, ce fichier | Validée le 10 septembre 2026 |
| 1 | Init Next.js, Supabase (migrations, RLS, bucket), auth, `OfferProvider` + tests | Validée le 11 septembre 2026, fusionnée dans `main` |
| 2 | Onboarding 6 étapes, mapping ROME, extraction CV/lettre, jobs `sync-offers` / `compute-matches`, écrans offres | Validée le 11 septembre 2026, fusionnée dans `main` |
| 3 | `enrich-company`, résumé entreprise, génération de lettre + diff | Validée le 11 septembre 2026, fusionnée dans `main` |
| 4 | Envoi, suivi, facturation (crédits ou abonnement selon A5), compte / export / suppression, Playwright | MVP validé le 11 septembre 2026, fusionné dans `main` et publié sur GitHub : candidature sur le site de l'offre puis suivi, compte, export, suppression, Playwright. Envoi par email et Stripe reportés (A3 à A5) |
| 5 | Landing, légal, rate limiting, Sentry, coûts LLM, `docs/RUNBOOK.md` complet | En partie dans le MVP : accueil, pages légales à compléter, limite de débit, en-têtes de sécurité, procédure de mise en ligne. Restent Sentry et la mise en ligne |

## 3. Stack

- **Next.js 16** App Router, TypeScript `strict` (TypeScript 6.0), Turbopack. Le fichier de session s'appelle `proxy.ts` (runtime Node.js), pas `middleware.ts`.
- **Tailwind CSS 4** (configuration en CSS, pas de `tailwind.config.js`) et **shadcn/ui** (style `base-nova`, composants Base UI, variables CSS aux couleurs de la page d'accueil dans `app/globals.css`, polices DM Sans, DM Mono et Instrument Serif chargées par `app/fonts.ts`).
- **Supabase** : Auth (email + mot de passe et Google), Postgres avec RLS sur toutes les tables, Storage bucket privé `documents`. Clés « publishable » et « secret » (les clés `anon` / `service_role` sont dépréciées fin 2026).
- **Supabase Cron** (`pg_cron` + `pg_net`) pour les tâches planifiées : il appelle une route protégée du site. Trigger.dev, prévu par le brief, est retiré (B10).
- **Anthropic SDK** `@anthropic-ai/sdk` : `claude-sonnet-5` (lettres), `claude-haiku-4-5-20251001` (ROME, résumé entreprise, extraction). Sorties JSON par « structured outputs » (`client.messages.parse` + `zodOutputFormat`). Installé ; pas de clé pour l'instant (décision de l'owner du 11 septembre 2026) : le choix des métiers utilise alors le classement de la nomenclature.
- **Stripe** : non installé. Le MVP est gratuit pendant la bêta tant que le modèle de prix (A5) n'est pas décidé ; le registre des crédits reste en base.
- **Zod 4** à toutes les frontières (formulaires, réponses API externes, variables d'environnement, sorties JSON LLM).
- **Vitest 5** (unitaires), **Playwright** (2 à 3 parcours critiques, phase 4).
- Déploiement : Vercel (Node 24) + Supabase cloud (région UE), dont Supabase Cron et Vault.
- Pas d'ORM : client Supabase typé par `lib/supabase/database.types.ts`.

## 4. Sources de données externes

| Source | Usage | Doc interne |
|---|---|---|
| API Alternance (`api.apprentissage.beta.gouv.fr/api`) | Recherche d'offres (`GET /job/v1/search`), détail (`GET /job/v1/offer/{id}`) | `docs/API_ALTERNANCE.md` |
| API Recherche d'entreprises (`recherche-entreprises.api.gouv.fr`) | Fiche entreprise (SIREN, NAF, effectifs, siège, dirigeants) | `docs/API_RECHERCHE_ENTREPRISES.md` |
| Géocodage BAN (Géoplateforme IGN `data.geopf.fr/geocodage`, ex `api-adresse.data.gouv.fr`) | Autocomplétion d'adresse, lat/lng, code INSEE | `docs/API_ADRESSE.md` |
| Nomenclature ROME (France Travail, open data) | Liste officielle des codes pour valider le mapping LLM | `docs/ROME.md` |
| Site web de l'entreprise | Page d'accueil + page « à propos », texte utile max 6 000 caractères | `docs/BRIEF.md` §3.3 |

Fichiers de référence bruts (spécifications OpenAPI, échantillons de réponses réelles, CSV ROME, libellés NAF) : `docs/reference/`.

Règles : tout appel externe passe par `/lib` avec schéma Zod sur la réponse, timeout, erreur typée (`lib/http/fetch-json.ts`). Respect de `robots.txt`, user-agent identifiable (`lib/brand.ts`), 1 requête max par domaine toutes les 2 s, timeout 8 s pour les sites d'entreprise.

Points structurants sur l'API Alternance (détails dans `docs/API_ALTERNANCE.md`) :
- Les pages officielles de l'API la réservent « à des usages non lucratifs » et interdisent « la facturation de l'accès pour des tiers comme des candidats ». L'owner a décidé le 10 septembre 2026 de ne pas solliciter le support : risque accepté, tracé dans `docs/QUESTIONS.md` (A1). Sans habilitation, la route de candidature reste fermée en production. Ne pas reproposer de contacter le support.
- Le type de jeton porte l'environnement : un jeton **sandbox** envoie tous les échanges, lectures comprises, vers l'environnement de test de La bonne alternance ; un jeton **production**, créé librement sur le portail, donne les offres réelles. Variables : `API_ALTERNANCE_KEY` (production, dans `.env.local`, échéance dans `docs/RUNBOOK.md`) et `API_ALTERNANCE_SANDBOX_KEY` (tests d'envoi).
- Une offre n'est candidatable par l'API que si `apply.recipient_id` est non nul ; les offres France Travail ne le sont en pratique pas (URL externe seulement).
- La recherche renvoie au plus 150 offres par source, sans pagination. `identifier.id` peut être nul selon la spécification : la clé externe est `partner_label` + `partner_job_id`.
- Limites : 60 recherches/min, 120 détails/min, 10 candidatures/min par clé ; côté La bonne alternance, 20 candidatures par jour et par SIRET pour une même organisation consommatrice, 3 par candidat et par offre. Pas d'idempotence sur la candidature : ne jamais rejouer un envoi accepté.
- Mesure du 10 septembre 2026 avec le jeton production : 46 % des offres ont un `recipient_id` ; aucune offre ne contient d'adresse email ; le site web n'est connu que pour 7 % des offres ; 38 % des offres sont gérées par une école (`is_delegated`). Détail dans `docs/API_ALTERNANCE.md`, section 0.

## 5. Arborescence

```
app/
  (marketing)/page.tsx          accueil provisoire (landing complète en phase 5)
  (auth)/                       login, signup, auth/callback (code OAuth ou PKCE), auth/confirm (token_hash), actions.ts
  (app)/layout.tsx              session obligatoire, vérifiée côté serveur
  (app)/onboarding/[step]/      parcours d'inscription (phase 2)
  (app)/(dashboard)/            onboarding terminé obligatoire : offers, applications, credits, account
  layout.tsx, not-found.tsx, globals.css
proxy.ts                        rafraîchit la session Supabase et redirige les visiteurs non connectés
components/                     app-header, coming-soon ; components/ui : shadcn/ui
lib/
  auth/routes.ts                routes protégées, destination sûre après connexion
  supabase/                     client.ts (navigateur), server.ts, admin.ts (clé secret), proxy.ts, database.types.ts
  providers/                    types.ts (OfferProvider), api-alternance.ts, adzuna.ts (stub V2), to-offer-row.ts
  http/fetch-json.ts            appels externes : timeout, reprises, Retry-After, Zod, erreurs typées
  env.ts, errors.ts, logger.ts, brand.ts, utils.ts
supabase/                       config.toml, migrations/, seed.sql, templates/confirmation.html
tests/                          unit/ (Vitest), fixtures/ (réponses API réelles anonymisées)
docs/                           BRIEF, UNDERSTANDING, QUESTIONS, API_*, ROME, RUNBOOK, reference/
```

Ajouts de la phase 2 : `lib/ai` (mapping ROME), `lib/documents`, `lib/geocoding`, `lib/matching`, `lib/offers` (synchronisation, filtres, rafraîchissement), `lib/onboarding`, `lib/rome`, `lib/text`, `lib/cron`, `app/api/geocode`, `app/api/cron/sync-offers`, `scripts/import-rome.ts`, `tests/db`. Ajouts de la phase 3 : `lib/enrichment` (répertoire des entreprises, site web, fiche, cache), `lib/letters` (adaptation, différences), `components/company-card.tsx`, `app/(app)/(dashboard)/applications/[id]`. Ajouts de la phase 4 : `lib/rate-limit.ts`, `lib/letters/follow-up.ts`, `app/(app)/(dashboard)/account`, `app/api/account/export`, `app/(marketing)` (pages légales), `app/(landing)` (page d'accueil de l'owner, CSS isolé sous `.lp`, C77), `tests/e2e`. À venir : `lib/credits`, `app/api/stripe/webhook`.

## 6. Conventions

### Langue
- Textes UI en français (accents corrects, vouvoiement). Code, commentaires, messages de commit en anglais.
- Pas de tirets cadratins dans les textes générés ni dans la doc. Dans le JSX, apostrophe typographique `’` (la règle `react/no-unescaped-entities` refuse `'`).

### Nommage
- Fichiers et dossiers : `kebab-case.ts`. Composants React : `PascalCase` dans des fichiers `kebab-case.tsx`.
- Fonctions et variables : `camelCase`. Types et schémas Zod : `PascalCase` (`OfferSchema`, `type Offer = z.infer<typeof OfferSchema>`).
- Tables et colonnes Postgres : `snake_case`, enums Postgres nommés `<table>_<colonne>` (ex. `applications_status`).
- Variables d'environnement : `SCREAMING_SNAKE_CASE`, préfixe `NEXT_PUBLIC_` uniquement pour ce qui est réellement public (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`).

### Gestion des erreurs
- `lib/errors.ts` : `AppError` (`code`, `message`, `cause`, `retryable`) et ses sous-classes `ConfigError`, `ValidationError`, `ExternalApiError` (source, status, extrait du corps, chemins Zod), `RateLimitedError`, `NotFoundError`, `InsufficientCreditsError`, `NotImplementedError`.
- Les fonctions de `/lib` lancent des erreurs typées, jamais de chaînes. Les frontières (route handlers, server actions, jobs) attrapent, loguent et traduisent en message utilisateur en français.
- Appels externes : `fetchJson` (timeout par `AbortSignal`, validation Zod, 2 reprises par défaut en GET sur réseau, 429, 419 et 5xx avec backoff exponentiel et `Retry-After`, aucune reprise en POST). Un élément invalide dans une liste est ignoré et compté, pas toute la réponse.
- Sorties LLM : JSON strict via structured outputs, validé par Zod ; une seule régénération automatique en cas d'échec de validation ou de post-traitement, puis erreur explicite à l'utilisateur.

### Appels Anthropic
- Toujours `client.messages.parse` avec `output_config.format = zodOutputFormat(Schema)` ; jamais de JSON extrait d'un texte libre.
- `claude-sonnet-5` refuse `temperature` (400) : pas de paramètre de température, `thinking: { type: "disabled" }` pour la lettre, consignes de sobriété dans le system prompt.
- `claude-haiku-4-5-20251001` : pas de paramètre `effort` ; `temperature` accepté sans thinking.
- Identifiants de modèle lus depuis `lib/env.ts` (`ANTHROPIC_MODEL_LETTER`, `ANTHROPIC_MODEL_LIGHT`).
- Tokens d'entrée et de sortie loggés et stockés (`applications.generation_tokens`).

### Secrets et configuration
- `lib/env.ts` valide les variables avec Zod, par groupe, à la première utilisation (`getPublicEnv`, `getSupabaseAdminEnv`, `getApiAlternanceEnv`...) : l'application démarre sans les comptes des phases suivantes, et une variable manquante lève une `ConfigError` qui cite son nom, jamais sa valeur. C'est le seul module qui lit `process.env`.
- `.env.local` jamais commité (ignoré par git) ; `.env.example` liste toutes les variables du projet.
- Aucune clé côté client : appels LLM et API externes uniquement côté serveur (server actions, route handlers). Le géocodage passe par `app/api/geocode`.
- `SUPABASE_SECRET_KEY` n'est utilisée que par `lib/supabase/admin.ts` (synchronisation planifiée, rafraîchissement des offres, webhook Stripe).
- Ne jamais afficher, logger ni committer un jeton. Le logger masque les clés sensibles par nom.

### Logs
- `lib/logger.ts` : une ligne JSON par événement (`debug`, `info`, `warn`, `error`), `child()` pour ajouter du contexte. Seul fichier autorisé à utiliser `console` (règle ESLint). Niveau par `LOG_LEVEL`, `warn` par défaut en test.
- Jamais de secret, de contenu de CV ni de lettre complète dans les logs : clés sensibles masquées, chaînes tronquées à 1 000 caractères.

### Next.js et interface
- Les formulaires à server action passent par `components/action-form.tsx` : la saisie reste en place quand le serveur renvoie une erreur (React 19 vide le formulaire après une action native).
- Server actions dans `app/**/actions.ts` : un fichier `"use server"` n'exporte que des fonctions async (et des types).
- `params` et `searchParams` des pages sont des `Promise` (Next 16).
- L'espace connecté est protégé deux fois : par `proxy.ts` et par les layouts `(app)` (session) et `(dashboard)` (onboarding terminé). Toute server action qui touche aux données vérifie à nouveau l'utilisateur.
- Destinations après connexion filtrées par `safeNextPath` (chemins relatifs uniquement).
- Composants shadcn/ui (Base UI) dans `components/ui`, installés par `npx shadcn@latest add <composant>`. Lien stylé en bouton : `buttonVariants`.

### Base de données et crédits
- Toutes les tables : `id uuid default gen_random_uuid()`, `created_at`, `updated_at` (trigger `set_updated_at`), RLS activée. Les utilisateurs ne lisent que leurs lignes ; `offers`, `companies` et le référentiel ROME sont en lecture seule ; les colonnes modifiables côté client sont listées par `grant update (...)`.
- Crédits, envoi, scores et statuts d'envoi ne sont jamais modifiables depuis le client : service role ou fonctions Postgres dédiées (phase 4).
- Toute opération sur les crédits passe par une fonction Postgres transactionnelle et idempotente (index uniques partiels sur `credit_transactions`). Les `event.id` Stripe traités sont stockés dans `stripe_events`.
- `offers.external_id` = `<partner_label>:<partner_job_id>` (source `api_alternance`).
- Un profil et un solde de crédits sont créés par trigger à l'inscription (`handle_new_user`).
- Migrations dans `supabase/migrations`. Sans Docker, elles sont rejouées sur PGlite avec une simulation d'auth et de storage Supabase (46 contrôles de RLS et de contraintes) ; ces tests sont dans `tests/db/migrations.test.ts` et tournent avec `npm test`. `lib/supabase/database.types.ts` est généré par la CLI officielle depuis le projet lié (`npm run db:types`).

### Tâches planifiées (Supabase Cron)
- Pas de service de jobs externe (décision de l'owner du 11 septembre 2026, B10) : Supabase Cron appelle toutes les 15 minutes la route protégée `app/api/cron/sync-offers`, avec `Authorization: Bearer <CRON_SECRET>`.
- Chaque appel traite un lot : au plus 25 recherches vieilles de plus de 6 heures, les jamais faites d'abord, en 40 secondes au plus, avec une pause entre deux appels à l'API. Il recalcule les correspondances des utilisateurs concernés puis retire les offres périmées (`lib/offers/scheduled-sync.ts`).
- L'adresse du site et le secret sont dans Supabase Vault (`candidatly_site_url`, `candidatly_cron_secret`) : la migration ne contient aucun secret et la tâche ne fait rien tant qu'ils manquent. Mise en service et contrôle : `docs/RUNBOOK.md`.
- Fin d'onboarding et bouton « Actualiser » : rafraîchissement immédiat dans la server action (`lib/offers/request-refresh.ts`), quelques secondes.
- La logique reste dans des fonctions de `/lib` testables unitairement ; la route et le cron ne font qu'orchestrer.

### Tests
- Vitest : `tests/unit/**/*.test.ts` et `tests/db/**/*.test.ts` (migrations et RLS sur PGlite). Réponses API simulées depuis `tests/fixtures/` (réponses réelles tronquées et anonymisées). Les clients externes acceptent `fetchImpl` et `sleep` injectés.
- Aucun test n'appelle une API externe réelle ni un LLM réel.
- Playwright : `tests/e2e/`, contre `next build && next start` (port 3100) et le projet Supabase lié. `global-setup.ts` crée une offre et deux étudiants inscrits, `global-teardown.ts` les supprime ; les parcours testés n'appellent aucune API externe. L'inscription elle-même n'est pas couverte, car elle appelle le géocodage et l'API Alternance.

### Git
- Commits atomiques, messages en anglais au format conventionnel : `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Une phase = une branche (`phase-1`...), fusionnée dans `main` après validation de l'owner.
- Depuis le 11 septembre 2026, l'owner demande de pousser tout le temps : chaque changement vérifié (typage, lint, tests) est fusionné dans `main` et poussé sur https://github.com/azoklearn/candidatly, avec les identifiants déjà enregistrés sur le poste. Jamais de jeton collé dans la conversation ; contrôle des secrets avant chaque push.

### Librairies hors stack
- Avant d'ajouter une librairie non listée dans le brief : justification en une phrase dans `docs/QUESTIONS.md` et accord de l'owner. Validées : `unpdf`, `mammoth` (phase 0), `@electric-sql/pglite` en développement (B9, 11 septembre 2026). Les dépendances installées par shadcn/ui (`@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `tw-animate-css`, `shadcn`) font partie de shadcn/ui.

## 7. Commandes utiles

```bash
npm run dev          # http://localhost:3000
npm run build        # build de production (vérifie aussi les types)
npm run typecheck    # next typegen puis tsc --noEmit
npm run lint         # ESLint (flat config)
npm test             # Vitest
npm run test:e2e     # Playwright : build de production, données de test sur le projet lié
npm run format       # Prettier
npm run db:start     # Supabase local (Docker requis)
npm run db:reset     # rejoue migrations + seed.sql
npm run db:types     # régénère lib/supabase/database.types.ts depuis le projet Supabase lié
npm run db:push      # applique les nouvelles migrations au projet lié (SUPABASE_DB_PASSWORD dans .env.local)
npx shadcn@latest add <composant>
npm run rome:import  # importe le référentiel ROME 4.0 (fichiers de docs/reference) dans le projet lié
stripe listen --forward-to localhost:3000/api/stripe/webhook   # phase 4
```

Sans projet Supabase configuré, l'application tourne : les pages publiques s'affichent, l'espace connecté redirige vers la connexion, et les formulaires indiquent que l'authentification n'est pas configurée.

## 8. Versions

Installées le 10 septembre 2026.

| Composant | Version | Note |
|---|---|---|
| Node.js | 24.x (`engines`) | Local 24.13 ; défaut Vercel |
| next / react | 16.3.4 / 19.2.8 | `proxy.ts`, API de requête asynchrones, Turbopack |
| typescript | 6.0.3 | typescript-eslint n'accepte pas encore TypeScript 7 |
| tailwindcss | 4 | |
| shadcn (CLI) | 4.21 | style `base-nova`, Base UI |
| @supabase/supabase-js / @supabase/ssr / supabase (CLI) | 2.116 / 0.12.7 / 2.117 | supabase-js v3 en préparation : rester en 2.x |
| zod | 4.6 | API v4 (`z.email()`, `error:`) |
| vitest | 5.0 | configuration en `vitest.config.mts` |
| eslint / eslint-config-next / prettier | 9 / 16.3.4 / 3.9 | ESLint 9 signalé comme plus maintenu, voir C51 |
| @anthropic-ai/sdk, stripe | 0.124 / 22.6 | installés dans leur phase |

Modèles Anthropic : `claude-sonnet-5` (contexte 1M, sortie max 128K, 2 $ / 10 $ par MTok, retrait pas avant le 30 juin 2027) ; `claude-haiku-4-5-20251001` (200K / 64K, 1 $ / 5 $ par MTok, retrait possible à partir du 15 octobre 2026).

## 9. Journal des décisions

- 2026-09-08 : phase 0 démarrée. Brief archivé dans `docs/BRIEF.md`. Docs API produites à partir de la documentation officielle et des spécifications OpenAPI sauvegardées dans `docs/reference/`, avec vérification croisée ; toute affirmation non confirmée est marquée « ⚠️ Non vérifié » dans les docs.
- 2026-09-09 : écarts de stack constatés et proposés par défaut (Trigger.dev v4, `proxy.ts`, clés Supabase publishable/secret, Zod 4, pas de température sur Sonnet 5, géocodage sur la Géoplateforme).
- 2026-09-10 : docs de référence finalisées. Jeton production API Alternance rangé dans `.env.local`, échéance le 10 septembre 2027 (`docs/RUNBOOK.md`). Un jeton sandbox renvoie des données de test même en lecture.
- 2026-09-10 : l'owner décide que l'envoi des candidatures sera une fonctionnalité d'un abonnement premium, par un email ouvert dans la boîte de l'étudiant. Les mesures sur données réelles montrent qu'aucune source autorisée ne fournit l'adresse du recruteur : questions A3 à A5.
- 2026-09-10 : l'owner décide de ne pas contacter le support de l'API Alternance. A1 est close, le risque est accepté.
- 2026-09-10 : phase 0 validée (« go »), hypothèses par défaut de la section B appliquées. Phase 1 : pas de Docker sur le poste, migrations vérifiées sur PGlite et types générés depuis le schéma migré ; TypeScript épinglé en 6.0 ; shadcn/ui avec Base UI ; auth email + mot de passe et Google, confirmation par `token_hash` (`/auth/confirm`) ou code PKCE (`/auth/callback`) ; le fournisseur API Alternance couvre recherche et détail, pas l'envoi (pas d'habilitation). Schéma : ajouts C42 à C47 appliqués, statut d'abonnement prévu en attendant A5.
- 2026-09-10 : projet Supabase cloud de développement « candidatly » créé par l'owner (région Paris, ref `ylupsjydkbmryctfrfte`) et lié à la CLI. Les six migrations y sont appliquées ; les types viennent désormais de la CLI officielle. Vérifié sur la base réelle : création du profil et du solde à l'inscription, RLS (profil, crédits, historique, tables de service), stockage privé par dossier et types de fichiers.
- 2026-09-11 : phase 2 livrée sur `phase-2`. Onboarding en 6 étapes, choix des métiers ROME (repli sur le classement de la nomenclature tant que la clé Anthropic manque), lecture des CV PDF et des lettres PDF, Word ou collées, recherche des offres et calcul des correspondances en ligne faute de compte Trigger.dev, écrans liste et détail des offres. Deux corrections après test réel : classement ROME (C55) et doublons du géocodeur (C58). Parcours complet vérifié sur le projet cloud avec un utilisateur de test.
- 2026-09-11 : l'owner se passe de l'API Anthropic pour l'instant et remplace Trigger.dev par Supabase Cron (B10). Trigger.dev est retiré du projet ; une migration planifie l'appel de `/api/cron/sync-offers` toutes les 15 minutes, l'adresse du site et le secret étant rangés dans Vault. Correction après test réel : une offre renvoyée deux fois par l'API faisait échouer l'enregistrement (C61).
- 2026-09-11 : phase 2 validée par l'owner (« je valide tout, lance tout ») et fusionnée dans `main`. Phase 3 démarrée sur `phase-3`, sans API Anthropic : fiche entreprise et lettre construites sans IA, avec un point d'entrée prévu pour un modèle plus tard.
- 2026-09-11 : phase 3 livrée sur `phase-3`, sans modèle de langage (B11). Fiche employeur depuis l'API Recherche d'entreprises (SIRET, ou nom et code postal avec notre propre score), lecture polie du site quand l'offre en donne un, cache de 30 jours (C62). Lettre adaptée par règles, affichée en différences surlignées avec la raison de chaque changement, modifiable, adaptation relançable 3 fois ; aucun crédit débité avant l'envoi (phase 4).
- 2026-09-11 : phase 3 validée et fusionnée. L'owner retire l'envoi par email du MVP (« on règlera ça plus tard ») et demande un produit qui fonctionne. MVP sur `phase-4` : l'étudiant candidate sur le site de l'offre avec sa lettre prête puis confirme l'envoi ; suivi des statuts, relance conseillée à J+5, passage en « sans réponse » à J+14 ; page Compte (profil, documents, export JSON, suppression réelle) ; accueil et pages légales ; limite de débit par utilisateur ; en-têtes de sécurité ; tests Playwright. Stripe non installé : MVP gratuit en bêta (A5 ouverte).
- 2026-09-11 : MVP validé par l'owner (« go ») et fusionné dans `main`. Dépôt publié sur https://github.com/azoklearn/candidatly (branche `main`) ; les branches de phase restent locales.
- 2026-09-11 : l'owner retire la confirmation de l'email à l'inscription (C76), les emails n'arrivant pas : la messagerie intégrée de Supabase n'envoie qu'aux membres de l'équipe. Réglage « Confirm email » coupé dans le tableau de bord le jour même (vérifié par `/auth/v1/settings`) ; Site URL et Redirect URLs réglées sur https://candidatly.vercel.app. À réactiver avec un serveur d'envoi avant l'ouverture publique.
- 2026-09-11 : page d'accueil de l'owner intégrée dans `app/(landing)` (C77) : design, animations et CTA brillant conservés, contenus rendus exacts (pas de faux avis ni de fonctions absentes), boutons vers le questionnaire.
- 2026-09-11 : l'owner réactive la confirmation de l'email (C78). Configuration locale alignée, messages d'inscription et de retour de lien clarifiés ; un serveur d'envoi reste nécessaire pour que les étudiants reçoivent l'email.
- 2026-09-11 : vérification de l'email supprimée définitivement (C79) : l'inscription connecte directement l'étudiant, avec confirmation côté serveur si Supabase la réclame encore ; test de bout en bout de l'inscription ajouté.
- 2026-09-11 : interface de l'application alignée sur la page d'accueil (palette et classes partagées dans `app/globals.css`, polices de `app/fonts.ts`, boutons pilule, CTA brillant `variant="shiny"`, grain) ; écrans de chargement (`loading.tsx` par page, squelettes, `PendingOverlay` pendant les actions longues) ; entreprises à fort potentiel d'embauche de l'API Alternance stockées dans `hiring_companies` et proposées en candidature spontanée sous 10 offres (C80).
- 2026-09-11 : nouveau domaine https://candidatly.app (DNS chez Vercel). Plus aucune mention de bêta ni de gratuité sur l'accueil, la page Crédits et les conditions (C81) ; bouton d'en-tête « Trouver mon stage/alternance ».
