# Brief projet — SaaS de candidature stage / alternance pour étudiants

> Brief d'origine, reproduit tel quel (reçu le 8 septembre 2026). Document de référence : ne pas modifier, les décisions et écarts sont tracés dans `docs/QUESTIONS.md` et `CLAUDE.md`.

Tu es le développeur principal de ce projet. Lis ce brief en entier, puis suis la section « Méthode de travail » avant d'écrire la moindre ligne de code.
Nom du projet : à définir. Utilise `candidatly` comme nom de code provisoire (dossier, package, variables).
---
## 1. Le produit
Un SaaS pour étudiants français qui :
1. Trouve les offres d'**alternance** (MVP) puis de **stage** (V2) correspondant à leur domaine, leur niveau et leur zone géographique.
2. Récupère et synthétise les infos de l'employeur pour chaque offre.
3. Adapte automatiquement la lettre de motivation de l'étudiant à chaque offre, en gardant sa voix.
4. Envoie la candidature (CV + lettre adaptée) après validation de l'étudiant, puis suit les réponses et propose les relances.
Concurrents : Alternly, FlowStudent, Jobea (tous sur la candidature spontanée). Notre angle : offres publiées + lettre réellement adaptée + fiche employeur + suivi.
Utilisateur type : étudiant Bac+2 à Bac+5, cherche entre juin et novembre, veut envoyer beaucoup de candidatures de qualité sans y passer ses soirées.
Principes non négociables :
- **L'étudiant valide chaque candidature avant envoi.** Jamais d'envoi silencieux.
- **Le LLM n'invente aucun fait** (ni sur l'étudiant, ni sur l'entreprise).
- **Aucun scraping** de LinkedIn, Indeed, Welcome to the Jungle ou tout site qui l'interdit dans ses CGU. On utilise uniquement des API officielles et le site public de l'entreprise.
- **RGPD** : données minimales, suppression de compte fonctionnelle, CV et lettres stockés chiffrés au repos (Supabase Storage privé), pas d'enrichissement d'emails de contacts par des services tiers au MVP.
---
## 2. Stack imposée
- **Next.js** (App Router, TypeScript strict), **Tailwind**, **shadcn/ui**
- **Supabase** : Auth (email + Google), Postgres, Storage (bucket privé `documents`), Row Level Security activée sur toutes les tables
- **Trigger.dev** (v3) pour les jobs asynchrones et planifiés
- **Anthropic SDK** (`@anthropic-ai/sdk`) : `claude-sonnet-5` pour la génération de lettres, `claude-haiku-4-5-20251001` pour les tâches légères (mapping ROME, résumé entreprise, extraction)
- **Stripe** (Checkout + webhooks) pour les paiements
- **Zod** pour valider toutes les entrées (formulaires, réponses API externes, sorties JSON du LLM)
- **Vitest** pour les tests unitaires, **Playwright** pour 2-3 parcours critiques
- Déploiement cible : Vercel + Supabase cloud + Trigger.dev cloud
Pas de Prisma, pas d'ORM : requêtes via le client Supabase typé (génère les types avec `supabase gen types`).
---
## 3. Sources de données externes
### 3.1 API Alternance (La Bonne Alternance — beta.gouv)
- Base : `https://api.apprentissage.beta.gouv.fr`
- Documentation technique : `https://api.apprentissage.beta.gouv.fr/fr/documentation-technique` — **lis-la avant d'implémenter, ne devine aucun endpoint ni paramètre de mémoire.**
- Auth : clé API gratuite (inscription sur le portail). Stocker dans `API_ALTERNANCE_KEY`.
- Trois routes à utiliser :
  - **Recherche d'opportunités d'emploi** : paramètres codes ROME, géoloc (lat/lng), rayon, niveau de diplôme. Retourne des offres partenaires (France Travail, Monster, Indeed, 1jeune1solution…) et des entreprises pour candidature spontanée. Au MVP on ne garde que les **offres publiées**.
  - **Détail d'une offre** par identifiant.
  - **Candidater à une offre** : transmet coordonnées, CV et message de motivation au recruteur. C'est notre canal d'envoi principal au MVP.
- Respecter les quotas de l'API, mettre en cache les résultats de recherche (TTL 6 h par couple ROME+zone).
### 3.2 API Recherche d'entreprises (api.gouv.fr)
- Base : `https://recherche-entreprises.api.gouv.fr` — gratuite, sans clé
- Sert à enrichir chaque offre : raison sociale, SIREN/SIRET, code NAF et libellé, tranche d'effectifs, adresse du siège, dirigeants, date de création.
- Recherche par SIRET si l'offre le fournit, sinon par nom + code postal, avec score de confiance ; si score faible, on n'affiche pas les données.
### 3.3 Site web de l'entreprise
- Si l'offre ou la fiche entreprise contient une URL : fetch de la page d'accueil et d'une page « à propos / qui sommes-nous » (détection par lien contenant `about`, `a-propos`, `qui-sommes-nous`, `notre-histoire`).
- Extraction du texte utile (pas de HTML brut), max 6 000 caractères, puis résumé LLM structuré (voir §6.2).
- Respecter `robots.txt`, timeout 8 s, user-agent identifiable, jamais plus d'une requête par domaine toutes les 2 s.
### 3.4 Stages (V2, ne pas implémenter au MVP)
- API Adzuna (agrégateur, clé gratuite) avec mot-clé `stage` ; API France Travail. Prévoir l'abstraction `OfferProvider` dès le MVP pour brancher ces sources sans refonte.
---
## 4. Schéma de base de données (Postgres / Supabase)
Toutes les tables ont `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`. RLS : un utilisateur ne voit que ses lignes.
```
profiles
  user_id (fk auth.users, unique)
  first_name, last_name, email, phone
  school, degree_label            -- ex: "BUT Information-Communication"
  diploma_level                    -- enum: bac, bac+2, bac+3, bac+4, bac+5
  target_contract                  -- enum: alternance, stage, both
  domain_free_text                 -- ce que l'étudiant a tapé
  rome_codes text[]                -- 2 à 5 codes ROME déduits
  location_label, location_lat, location_lng, insee_code
  search_radius_km int default 30
  availability_date date
  onboarding_completed bool default false
documents
  user_id
  kind                             -- enum: cv, cover_letter_base
  storage_path                     -- chemin dans le bucket privé
  extracted_text text              -- texte extrait (pdf/docx) pour le LLM
  is_current bool
offers                             -- cache normalisé des offres externes
  external_id, source              -- source enum: api_alternance, adzuna, france_travail
  unique(source, external_id)
  title, description, contract_type, diploma_level
  company_name, company_siret, company_website
  location_label, lat, lng, insee_code
  rome_codes text[]
  published_at, expires_at
  apply_channel                    -- enum: api_alternance, email, external_url
  apply_target                     -- email ou URL si applicable
  raw jsonb                        -- payload brut de la source
companies
  siret unique, siren
  legal_name, brand_name
  naf_code, naf_label
  headcount_range
  address, postal_code, city
  website
  executives jsonb
  summary jsonb                    -- sortie structurée du LLM (§6.2)
  summary_generated_at
matches                            -- une offre proposée à un utilisateur
  user_id, offer_id
  unique(user_id, offer_id)
  score numeric                    -- 0-100
  score_reasons jsonb
  status                           -- enum: new, saved, dismissed, applied
applications
  user_id, offer_id, match_id
  cover_letter_text                -- version finale validée
  cover_letter_diff jsonb          -- passages modifiés vs lettre de base
  generation_model, generation_tokens
  status                           -- enum: draft, ready, sent, viewed, replied_positive, replied_negative, no_answer
  sent_at, sent_via                -- api_alternance | gmail | manual
  external_application_id
  next_follow_up_at
  notes text
credits
  user_id
  balance int default 0
credit_transactions
  user_id, delta int, reason      -- enum: purchase, application_sent, refund, signup_bonus
  stripe_payment_intent_id
events                             -- audit léger
  user_id, type, payload jsonb
```
---
## 5. Parcours utilisateur et écrans
### 5.1 Onboarding (obligatoire avant le dashboard)
1. Création de compte (email ou Google).
2. Profil : nom, école, formation, niveau, type de contrat, date de disponibilité.
3. Domaine recherché en texte libre → appel LLM (Haiku) qui propose 3-5 codes ROME avec libellés, l'étudiant coche/ajuste.
4. Localisation : autocomplétion d'adresse (API Adresse `https://api-adresse.data.gouv.fr`, gratuite) → lat/lng + code INSEE ; rayon en km.
5. Upload CV (PDF) et lettre de motivation de base (PDF, DOCX ou texte collé). Extraction du texte, aperçu, confirmation.
6. 5 crédits offerts à l'inscription.
### 5.2 Dashboard « Offres »
- Liste des `matches` triés par score, filtres (distance, date, entreprise), carte optionnelle.
- Carte offre : titre, entreprise, ville, distance, date, badge « fiche entreprise dispo ».
- Actions : voir le détail, enregistrer, ignorer.
### 5.3 Détail d'une offre
- Colonne gauche : l'offre (description nettoyée).
- Colonne droite : fiche entreprise (§6.2) — activité, taille, ce qu'ils font concrètement, points d'accroche possibles.
- Bouton « Préparer ma candidature » → consomme 1 crédit à l'envoi, pas à la génération.
### 5.4 Préparation de la candidature
- Génération de la lettre adaptée (§6.1), affichage en **diff surligné** par rapport à la lettre de base : passages modifiés en couleur, tooltip « pourquoi ».
- Édition libre dans un textarea, régénération possible (max 3 par candidature).
- Récap avant envoi : destinataire, pièces jointes, canal.
- Bouton « Envoyer » → confirmation explicite → envoi via la route candidature de l'API Alternance → statut `sent`, débit d'1 crédit.
### 5.5 Suivi « Mes candidatures »
- Tableau kanban ou liste : envoyée / vue / réponse positive / négative / sans réponse.
- Relance suggérée à J+5 sans réponse : texte court généré, l'étudiant l'envoie en un clic (V2 quand Gmail sera connecté ; au MVP, affiche le texte à copier et les coordonnées).
- L'étudiant met à jour le statut manuellement quand il reçoit une réponse.
### 5.6 Crédits et paiement
- Page « Crédits » : solde, historique, packs Stripe : 10 candidatures 4,99 €, 30 candidatures 11,99 €, 100 candidatures 29,99 €. Pas d'abonnement, les crédits n'expirent pas.
- Webhook Stripe `checkout.session.completed` → crédit du solde, idempotent.
### 5.7 Compte
- Modifier profil, remplacer CV/lettre, exporter mes données (JSON), supprimer mon compte (suppression réelle des fichiers et lignes).
---
## 6. Jobs asynchrones (Trigger.dev)
| Job | Déclencheur | Rôle |
|---|---|---|
| `sync-offers` | cron toutes les 6 h | Pour chaque combinaison (rome_codes, zone) active chez au moins un utilisateur : appel API Alternance, upsert dans `offers`, suppression logique des offres expirées |
| `compute-matches` | après `sync-offers` et à la fin de l'onboarding | Score 0-100 par (user, offer) : distance, correspondance ROME, niveau de diplôme, fraîcheur, mots-clés du CV présents dans l'offre. Insère/maj `matches` |
| `enrich-company` | à la création d'une offre avec SIRET ou nom+CP inconnu | API Recherche d'entreprises + fetch site web + résumé LLM → `companies` |
| `generate-cover-letter` | action utilisateur | §6.1, écrit `applications` en `draft` |
| `send-application` | action utilisateur confirmée | Appel route candidature API Alternance, gestion des erreurs, débit crédit, événement |
| `schedule-follow-ups` | cron quotidien | Passe en `no_answer` les candidatures sans réponse à J+14, positionne `next_follow_up_at` à J+5 |
Chaque job : idempotent, retry avec backoff, logs structurés, jamais de secret dans les logs.
### 6.1 Prompt de génération de lettre (à implémenter dans `lib/ai/cover-letter.ts`)
Modèle : `claude-sonnet-5`. Température basse (0.3). Sortie **JSON strict** validée par Zod.
Entrées : `base_letter`, `offer` (titre, description, entreprise, ville, contrat), `company_summary` (§6.2), `profile` (formation, niveau, disponibilité), `cv_text` (extraits pertinents, max 2 500 caractères).
System prompt (à reprendre tel quel, puis ajuster après tests) :
```
Tu adaptes la lettre de motivation d'un étudiant à une offre précise.
Règles absolues :
1. Conserve la voix, le ton, la structure et le niveau de langue de la lettre de base. Le recruteur doit lire un texte écrit par l'étudiant, pas par une IA.
2. Modifie uniquement ce qui doit l'être pour coller à l'offre et à l'entreprise : accroche, mention du poste et de l'entreprise, 1 à 2 phrases reliant le parcours de l'étudiant aux missions ou à l'activité de l'entreprise, formule de conclusion.
3. N'invente aucun fait : pas de compétence, expérience, diplôme ou motivation absents de la lettre de base ou du CV ; pas d'information sur l'entreprise absente de la fiche fournie. Si tu manques d'un élément, reste général plutôt que d'inventer.
4. Longueur finale : entre 90 % et 110 % de la lettre de base.
5. Pas de formules creuses ("je suis passionné", "entreprise dynamique", "relever de nouveaux défis"), pas de superlatifs, pas de tirets cadratins, pas de listes.
6. Français correct, tutoiement interdit, accents corrects.
Réponds uniquement avec un objet JSON de la forme :
{
  "letter": "texte complet de la lettre adaptée",
  "changes": [
    { "original": "passage d'origine", "replacement": "passage modifié", "reason": "en une phrase" }
  ],
  "confidence": 0.0 à 1.0,
  "missing_info": ["éléments qui auraient permis une meilleure adaptation"]
}
```
Post-traitement : vérifier la longueur, vérifier que chaque `original` existe bien dans la lettre de base (sinon rejeter et régénérer une fois), stocker `changes` dans `cover_letter_diff`.
### 6.2 Résumé entreprise (`lib/ai/company-summary.ts`)
Modèle : `claude-haiku-4-5-20251001`. Entrées : données API Recherche d'entreprises + texte extrait du site. Sortie JSON :
```
{
  "what_they_do": "2 phrases, factuel",
  "size_and_context": "1 phrase : taille, localisation, âge",
  "recent_or_notable": ["max 3 éléments trouvés sur le site, sinon tableau vide"],
  "hooks_for_candidate": ["2-3 angles d'accroche possibles, formulés comme des pistes, pas des phrases toutes faites"],
  "sources": ["urls utilisées"]
}
```
Interdiction d'inventer : si le site est inaccessible, `recent_or_notable` et `hooks_for_candidate` restent vides et l'UI l'indique.
---
## 7. Arborescence cible
```
/app
  /(marketing)          landing, tarifs, mentions légales, confidentialité
  /(auth)               login, signup, callback
  /(app)
    /onboarding/[step]
    /offers               liste + détail [id]
    /applications         suivi
    /credits
    /account
  /api
    /stripe/webhook
    /trigger              endpoint Trigger.dev
/components
/lib
  /supabase             clients server/browser, types générés
  /providers            OfferProvider (interface) + api-alternance.ts, adzuna.ts (stub)
  /enrichment           recherche-entreprises.ts, website-fetch.ts
  /ai                   client anthropic, cover-letter.ts, company-summary.ts, rome-mapping.ts
  /matching             score.ts
  /credits              ledger.ts
  /documents            extract-text.ts (pdf, docx)
/trigger                jobs
/supabase
  /migrations
  seed.sql
/tests
CLAUDE.md
.env.example
```
---
## 8. Méthode de travail (dans cet ordre)
### Phase 0 — Compréhension et cadrage (avant tout code)
1. Relis ce brief et reformule-le en 15 lignes max dans un fichier `docs/UNDERSTANDING.md` : ce que fait le produit, ce qu'il ne fait pas au MVP, les 3 risques techniques principaux.
2. Va lire la documentation technique de l'API Alternance et note dans `docs/API_ALTERNANCE.md` : les endpoints exacts, les paramètres, le format des réponses, les quotas, ce qu'il faut pour obtenir une clé. Fais pareil pour l'API Recherche d'entreprises et l'API Adresse.
3. Liste tes questions ouvertes dans `docs/QUESTIONS.md`. Pose-moi les questions bloquantes maintenant. Pour les non bloquantes, propose une hypothèse par défaut et avance.
4. Crée `CLAUDE.md` à la racine : résumé du projet, stack, conventions (nommage, gestion d'erreurs, où vont les secrets, comment lancer les tests), liste des commandes utiles. Tu le maintiendras à jour à chaque phase.
Attends ma validation de la phase 0 avant de passer à la phase 1.
### Phase 1 — Fondations
- Init Next.js + TypeScript strict + Tailwind + shadcn/ui, ESLint, Prettier.
- Supabase : migrations pour toutes les tables du §4, RLS, bucket `documents`, génération des types.
- Auth email + Google, layout `(app)` protégé, `.env.example` complet.
- Interface `OfferProvider` + implémentation `api-alternance.ts` avec tests unitaires sur des réponses mockées.
- Commit atomiques, messages en anglais au format conventionnel (`feat:`, `fix:`, `chore:`).
### Phase 2 — Onboarding + offres
- Les 6 étapes d'onboarding, mapping ROME par LLM, extraction texte CV/lettre.
- Jobs `sync-offers` et `compute-matches`.
- Écrans liste et détail d'offre.
### Phase 3 — Entreprise + lettre
- Job `enrich-company`, résumé LLM, fiche dans le détail d'offre.
- Génération de lettre, diff surligné, édition, régénération limitée.
### Phase 4 — Envoi, suivi, paiement
- Envoi via API Alternance, statuts, `schedule-follow-ups`.
- Stripe Checkout + webhook idempotent + ledger de crédits.
- Pages compte, export et suppression des données.
- Tests Playwright : onboarding complet, préparation + envoi d'une candidature (en mode mock), achat de crédits (Stripe test).
### Phase 5 — Préparation bêta
- Landing minimale, mentions légales, politique de confidentialité, CGU.
- Rate limiting sur les routes coûteuses (génération, envoi).
- Monitoring des erreurs (Sentry) et des coûts LLM (tokens par génération loggés dans `applications`).
- `docs/RUNBOOK.md` : déploiement, variables, que faire si l'API Alternance tombe.
À la fin de chaque phase : résumé de ce qui est fait, ce qui reste, les décisions prises, et mise à jour de `CLAUDE.md`.
---
## 9. Conventions
- Tout appel externe (API, LLM) passe par une fonction dans `/lib` avec schéma Zod sur la réponse, timeout, et erreur typée. Jamais d'appel direct depuis un composant.
- Aucune clé ou secret côté client. Les appels LLM et API externes se font uniquement côté serveur ou dans les jobs.
- Les textes UI sont en français, le code et les commentaires en anglais.
- Pas de `any`. Pas de `console.log` en production : utilise un logger.
- Chaque fonction qui touche aux crédits est transactionnelle et idempotente.
- Avant de proposer une librairie non listée dans la stack, justifie-la en une phrase et attends mon accord.
Commence par la phase 0.
