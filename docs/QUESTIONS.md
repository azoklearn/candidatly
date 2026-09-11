# Questions ouvertes et décisions (phase 0)

Dernière mise à jour : 10 septembre 2026.

Comment lire ce document :
- **0. Décision du 10 septembre 2026** et mesures sur données réelles.
- **A. Bloquant** : une réponse de l'owner est nécessaire avant de construire dessus. Pour chaque question : pourquoi elle bloque, les options, la recommandation.
- **B. Accord requis** : écarts par rapport au brief ou librairies hors stack. Le brief impose une justification et un accord explicite ; l'hypothèse par défaut est indiquée et sera appliquée sans réponse contraire lors de la validation de la phase 0.
- **C. Non bloquant** : hypothèse par défaut appliquée, à corriger si besoin.
- **D. Comptes et accès** à préparer côté owner, **E. Versions**, **F. Vérifications** à faire dès que les jetons de l'API Alternance existent.

Les faits cités proviennent de `docs/API_ALTERNANCE.md`, `docs/API_RECHERCHE_ENTREPRISES.md`, `docs/API_ADRESSE.md`, `docs/ROME.md` et des spécifications sauvegardées dans `docs/reference/`.

---

## 0. Décision de l'owner du 10 septembre 2026 et mesures sur données réelles

**Décision.** L'envoi des candidatures devient une fonctionnalité d'un abonnement premium, plus cher. Il ne passe plus par la route de candidature de l'API Alternance : l'application récupère l'adresse email du recruteur et ouvre un email personnalisé dans la boîte mail de l'étudiant, qui l'envoie lui-même. « Récupération du mail » est comprise ici comme l'adresse email du recruteur. Cette décision modifie le brief sur deux points : il ne prévoyait pas d'abonnement, et l'envoi passait par l'API.

**Mesures du 10 septembre 2026**, avec le jeton production, sur 12 recherches réelles : Paris, Lyon, Angers et Guéret, trois domaines, rayon de 30 km, soit 151 offres uniques. Détail dans `docs/API_ALTERNANCE.md`, section 0.

| Constat | Mesure |
|---|---|
| Offres dont le texte contient une adresse email | 0 sur 151 |
| Offres candidatables par la route de candidature de l'API (`recipient_id` renseigné) | 69 sur 151, soit 46 % : toutes les offres déposées sur La bonne alternance, aucune offre France Travail |
| Offres avec un site web d'entreprise | 10 sur 151 |
| Offres gérées par une école ou un CFA (`is_delegated`) | 57 sur 151 |
| Entreprises qui recrutent sans offre publiée (`recruiters`) | 934, dont 293 candidatables par l'API, aucune avec site web |

**Conséquence.** Avec les sources autorisées par le brief, l'adresse email du recruteur n'est disponible pour aucune offre. L'API la garde et ne la transmet qu'à travers sa route de candidature. Le modèle « email ouvert dans la boîte de l'étudiant » ne peut donc pas fonctionner tel quel : voir A3, puis A4 et A5.

---

## A. Questions bloquantes

### A1. Le modèle payant est-il compatible avec les conditions de l'API Alternance ?

**Décision de l'owner, 10 septembre 2026 : pas de contact avec le support.** Le risque décrit ci-dessous est accepté, et A1 ne bloque plus aucune phase. Sans habilitation, la route de candidature de l'API reste fermée en production : voir A3.

**Le risque, pour mémoire.** Toutes les offres viennent de cette API, et ses conditions publiées s'opposent à un service payant :
1. Les pages officielles des routes de recherche et de détail d'offre (HTML servi par le portail, vérifié le 9 septembre 2026) : « L'utilisation de cette API est gratuite et réservée à des usages non lucratifs. Notez que toute utilisation de ces données à des fins commerciales, telles que la revente ou la facturation de l'accès pour des tiers comme des candidats est interdite. » La page du détail d'offre ajoute « candidats, entreprises ou écoles ».
2. Les CGU du portail (v1.0, 31 mars 2025) : « Il s'engage à ne pas commercialiser les données reçues et à ne pas les communiquer à des tiers en dehors des cas prévus par la loi. »
3. La route de candidature est, avec le widget `/postuler`, le seul moyen de joindre le recruteur des offres déposées sur La bonne alternance (section 0). Elle exige une habilitation accordée à la main par le support, que le compte actuel, rattaché à aucune organisation, n'a pas.
4. Nuance : la licence des données déclarée dans la spécification est Etalab 2.0, qui autorise la réutilisation commerciale avec mention de la source. Elle ne l'emporte pas sur les conditions affichées par le portail.

En cas de contrôle, l'éditeur peut suspendre ou bloquer l'accès du compte (CGU art. 5.1). Précaution retenue : afficher la source « La bonne alternance » avec un lien vers chaque offre, et ne jamais revendre ni transmettre les données.

### A2. Que fait-on des offres qui ne sont pas candidatables par l'API ?

**Appliqué dans le MVP (11 septembre 2026)** : pour toutes les offres, la lettre est préparée, l'étudiant candidate sur le site de l'offre, puis confirme l'envoi dans Candidatly (C67).

Mesuré le 10 septembre 2026 : 54 % des offres n'ont pas de `recipient_id`, dont toutes les offres France Travail, Meteojob, RH Alternance et iquesta. Pour elles, la seule voie est le site du partenaire indiqué par `apply.url` (directemploi.com, candidat.francetravail.fr, meteojob.com, etc.). Cette question est désormais traitée avec A3. Recommandation inchangée : les afficher, préparer la lettre adaptée, laisser l'étudiant candidater sur le site du partenaire, puis lui faire confirmer l'envoi.

### A3. D'où vient l'adresse email du recruteur ?

**Reportée par l'owner le 11 septembre 2026** : pas d'envoi par email dans le MVP.

**Pourquoi c'est bloquant.** Le canal d'envoi décidé le 10 septembre repose sur cette adresse, et aucune source autorisée ne la fournit (section 0). Le brief exclut les services d'enrichissement d'emails au MVP et le scraping des job boards.

**Options.**
1. Canal mixte, selon ce que permet chaque offre : route de candidature de l'API pour les offres qui ont un `recipient_id` (46 % mesurés, habilitation requise, voir A1), candidature sur le site du partenaire pour les autres, avec la lettre adaptée prête à coller. L'email ouvert dans la boîte de l'étudiant ne sert que lorsqu'une adresse est réellement connue, par exemple publiée sur le site de l'entreprise.
2. Widget officiel `/postuler` de La bonne alternance pour les offres qui ont un `recipient_id` : l'étudiant candidate sur le formulaire de La bonne alternance intégré à Candidatly, sans habilitation. Les autres offres passent par le site du partenaire.
3. Recherche d'adresses sur les sites des entreprises, page contact comprise, dans le respect de `robots.txt`. Couverture faible : le site n'est connu que pour 7 % des offres, et l'adresse trouvée sera souvent générique.
4. Service tiers d'enrichissement d'emails : exclu par le brief au MVP, et fragile au regard du RGPD pour des adresses nominatives.

**Recommandation.** Sans habilitation (A1), l'option 1 n'est pas disponible en production. Option 2 pour les offres qui ont un `recipient_id`, site du partenaire pour les autres, et email ouvert dans la boîte de l'étudiant quand une adresse est connue. L'abonnement premium peut porter sur l'envoi assisté, quel que soit le canal. Piste à vérifier : l'API Offres d'emploi de France Travail exposerait parfois un contact recruteur. ⚠️ Non vérifié : il faut un compte francetravail.io pour le confirmer.

### A4. Comment l'email s'ouvre-t-il dans la boîte de l'étudiant ?

**Reportée avec A3.**

Question utile seulement quand une adresse est connue (A3).

**Options.**
1. Lien `mailto:` ou lien de rédaction Gmail ou Outlook pré-rempli : simple, sans autorisation, mais le CV ne peut pas être joint automatiquement, et certains navigateurs et clients mail limitent la longueur du texte pré-rempli.
2. Brouillon créé dans la boîte de l'étudiant par l'API Gmail ou Microsoft Graph, CV joint : meilleure expérience, mais connexion OAuth à la messagerie. ⚠️ Non vérifié : le scope Gmail nécessaire est probablement soumis à une vérification de l'application par Google.

**Recommandation.** Option 1 au lancement, option 2 quand le volume le justifie. Dans les deux cas, l'étudiant envoie lui-même, ce qui respecte le principe « jamais d'envoi silencieux ».

### A5. Quel modèle de prix ?

**En attente.** Par défaut, le MVP est gratuit pendant la bêta et Stripe n'est pas installé ; le registre des crédits et le bonus d'inscription restent en base pour la suite.

Le brief prévoyait des packs de crédits sans abonnement ; la décision du 10 septembre ajoute un abonnement premium pour l'envoi.

**Options.**
1. Crédits pour la préparation (lettre adaptée, fiche entreprise), abonnement premium pour l'envoi assisté.
2. Tout par abonnement, avec deux paliers.
3. Abonnement premium seul, avec une préparation gratuite et limitée.

**Recommandation.** À trancher par l'owner avant la phase 4, qui construit la facturation. Hypothèse pour la phase 1 : le schéma accepte à la fois des crédits et un statut d'abonnement, pour ne rien figer. Les abonnements passent par Stripe Billing, dans la stack imposée.

---

## B. Accords requis (écarts par rapport au brief, librairies hors stack)

| # | Sujet | Ce que dit le brief | Constat vérifié | Hypothèse par défaut |
|---|---|---|---|---|
| B1 | Trigger.dev | « Trigger.dev (v3) » et une route `/api/trigger` dans l'arborescence | La v3 est retirée (« Trigger.dev v3 has been retired ») ; SDK actuel 4.5.x ; aucune route Next.js n'est nécessaire, les tâches sont déclenchées par `tasks.trigger()` côté serveur | Remplacé par B10 : Trigger.dev n'est plus utilisé |
| B2 | Extraction PDF et DOCX | Non précisé (« extraction du texte ») | Aucune lib de la stack ne lit un PDF. `unpdf` (unjs, MIT, build PDF.js sans binaire natif, Node >= 22) et `mammoth` (BSD, JS pur) sont maintenus et adaptés à Vercel / Trigger.dev. `pdf-parse` 2.x impose un binaire natif `@napi-rs/canvas` | Ajouter `unpdf` et `mammoth` ; justification : maintenus, sans dépendance native et adaptés au serverless (`pdf2json`, l'autre option sans dépendance, repose sur un fork ancien de PDF.js) |
| B3 | Génération de lettre | « Température basse (0.3) » | `claude-sonnet-5` renvoie 400 si `temperature`, `top_p` ou `top_k` est fixé ; le thinking adaptatif est actif par défaut | Pas de température ; `thinking: { type: "disabled" }` pour un rendu déterministe et un coût maîtrisé ; sobriété imposée par le system prompt ; sortie via structured outputs. Alternative si la qualité déçoit en test : thinking adaptatif avec `effort: "medium"` |
| B4 | API Adresse | `https://api-adresse.data.gouv.fr` | L'API Adresse de la BAN a été transférée à l'IGN (Géoplateforme). Le service historique répond encore mais son arrêt a été annoncé (redirection prévue jusqu'au 14 avril 2026, non effective au 9 septembre 2026, sans date garantie). Même contrat d'API sur `https://data.geopf.fr/geocodage` | Base URL Géoplateforme, ancien hôte non utilisé |
| B5 | Session Next.js | Non précisé | Next.js 16 renomme `middleware.ts` en `proxy.ts` (runtime Node.js obligatoire) ; pattern Supabase officiel `updateSession` + `getClaims()` | `proxy.ts` |
| B6 | Clés Supabase | Non précisé | Les clés `anon` / `service_role` sont dépréciées fin 2026 au profit des clés `sb_publishable_...` / `sb_secret_...` | Variables `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SECRET_KEY` |
| B7 | Logger | « utilise un logger » | Aucune lib de log dans la stack | Wrapper maison `lib/logger.ts` (une ligne JSON par événement sur stdout, lue par les journaux de Vercel). Pas de lib externe au MVP ; Sentry en phase 5 comme prévu |
| B8 | Zod | « Zod » | Zod 4 est la version courante (`zod` 4.5.x) ; API v4 (`z.email()`, `error:`) | Zod 4 |
| B9 | Tests de la base sans Docker | Non précisé | PGlite (Postgres 18 compilé en WebAssembly, `@electric-sql/pglite`, licence Apache 2.0) rejoue les migrations et teste la RLS en quelques secondes, sans Docker ni réseau | **Accepté le 11 septembre 2026** : dépendance de développement, tests dans `tests/db/`, lancés par `npm test` |
| B10 | Tâches planifiées | « Trigger.dev » pour `sync-offers` et les autres jobs | L'owner ne souhaite pas de compte Trigger.dev. Comparaison du 11 septembre 2026 : Vercel Cron est limité à une exécution par jour en offre gratuite ; Railway coûte 5 $ par mois et ajoute un service à déployer ; Supabase Cron (`pg_cron` et `pg_net`) est déjà disponible sur le projet | **Choisi par l'owner le 11 septembre 2026** : Supabase Cron appelle `/api/cron/sync-offers` toutes les 15 minutes, secrets dans Vault ; Trigger.dev retiré du projet |
| B11 | Fiche entreprise et lettre sans modèle de langage | « Résumé LLM » (Haiku, §6.2) et « génération de lettre » (Sonnet 5, §6.1) | L'owner se passe de l'API Anthropic (11 septembre 2026) | **Appliqué** : fiche et lettre construites par règles, sans rien inventer, avec les formats de sortie des §6.1 et §6.2 ; un modèle pourra remplacer les règles sans toucher aux écrans (`lib/letters/adapt.ts`, `lib/enrichment/company-summary.ts`) |

---

## C. Questions non bloquantes, hypothèses par défaut

### Produit

| # | Question | Hypothèse par défaut | Raison |
|---|---|---|---|
| C1 | Nom du produit et domaine | `candidatly` partout jusqu'à décision ; le nom est une constante unique (`lib/brand.ts`) | Renommage sans risque |
| C2 | Prix TTC ou HT, TVA | Prix du brief affichés TTC ; Stripe Tax non activé au MVP ; mention « TTC » sur la page Crédits | Cible B2C en France |
| C3 | Moment du débit | Dépend du modèle de prix (A5). Par défaut : jamais à la génération, et à l'envoi confirmé, par l'API (202) ou par l'étudiant (« J'ai envoyé ») | Conforme au brief ; paramétrable |
| C4 | Valeurs de `applications.sent_via` | `api_alternance`, `widget`, `partner_site` (candidature sur le site du partenaire), `mail_client` (email ouvert dans la boîte de l'étudiant), `gmail` (brouillon créé par l'API Gmail, V2) | Couvre les options de A3 et A4 |
| C5 | Régénérations | 3 régénérations manuelles max par candidature, plus 1 régénération automatique en cas de sortie invalide, compteur stocké sur `applications` | Brief §5.4 + post-traitement §6.1 |
| C6 | Sens et mapping de `profiles.diploma_level` | `diploma_level` désigne le niveau du diplôme **préparé pendant l'alternance** (niveau visé), pas le dernier diplôme obtenu, et la question d'onboarding est formulée ainsi. Mapping vers `target_diploma_level` : `bac` = 4, `bac+2` = 5, `bac+3` = 6, `bac+4` = 6, `bac+5` = 7 | L'API filtre sur le niveau visé en fin d'études ; enum `3` à `7`, sans niveau propre pour Bac+4 |
| C7 | Filtre par niveau | Toujours passer `target_diploma_level` : l'API renvoie les offres du niveau demandé et celles sans niveau précisé | Comportement documenté |
| C8 | Type de contrat | Au MVP, `contract.type` accepte `Apprentissage` et `Professionnalisation` ; on affiche les deux, avec un badge | L'API ne filtre pas par type |
| C9 | Offres à candidature spontanée (`recruiters`) | Ignorées au MVP (le brief ne garde que les offres publiées) ; le provider les expose quand même pour la V2 | Angle produit du brief |
| C10 | Relance à J+5 | Le texte de relance est généré par Haiku et affiché avec le téléphone de `apply.phone` s'il existe ; pas d'envoi | Brief §5.5 ; l'email recruteur n'est pas exposé par l'API |
| C11 | Suivi « vue » | Le statut `viewed` reste manuel : l'API n'offre ni webhook ni lecture de candidature ; les réponses du recruteur vont directement dans la boîte mail de l'étudiant | Fait vérifié |
| C12 | Dirigeants dans la fiche entreprise | Afficher nom, prénom et qualité des dirigeants personnes physiques, sans année de naissance ; pas d'affichage pour les entreprises non diffusibles | Licence Ouverte 2.0 + minimisation RGPD |
| C13 | Fiche entreprise sans site | La fiche affiche les données administratives et le message « Site web non exploité » ; `recent_or_notable` et `hooks_for_candidate` vides | Brief §6.2 |
| C14 | Carte dans le dashboard | Pas de carte au MVP (le brief la dit optionnelle) ; distance affichée en km | Coût / valeur |

### Données et API

| # | Question | Hypothèse par défaut | Raison |
|---|---|---|---|
| C15 | Clé d'unicité des offres | `offers.external_id = <partner_label>:<partner_job_id>`, `source = api_alternance` ; `identifier.id` stocké dans `raw` quand il existe | La spécification dit `identifier.id` nul pour France Travail, le code récent de LBA suggère le contraire : la clé composite fonctionne dans les deux cas |
| C16 | Stratégie de `sync-offers` | Recherche par couple (codes ROME du profil, lat/lng, rayon) toutes les 6 h comme le brief, avec `target_diploma_level` ; les couples sont dédupliqués (arrondi des coordonnées à 0,01°, rayon, codes triés) | 150 résultats max par source suffisent avec un rayon de 30 km ; la fiche data.gouv.fr mentionne un maximum de 20 codes ROME par requête (absent de la spécification), le brief en prévoit 2 à 5 ; l'export quotidien (`GET /job/v1/export`, 2 appels/min, mise à jour à 3h00) reste une option V2 si les quotas deviennent limitants |
| C17 | Expiration des offres | Une offre devient invisible si `offer.publication.expiration` est dépassée ou si elle n'apparaît plus dans deux syncs consécutifs ; purge physique après 90 jours | Aucune règle de rétention publiée par l'API |
| C18 | Rafraîchissement avant envoi | `GET /job/v1/offer/{id}` juste avant l'envoi pour vérifier `status = Active` et récupérer un `recipient_id` à jour ; sinon, message « offre expirée » et pas de débit | L'envoi échoue en 400 « Job offer has expired » sinon |
| C19 | Limite « 20 candidatures par jour et par SIRET » côté LBA | Compteur local par SIRET et par jour ; au-delà, message « limite quotidienne atteinte pour cette entreprise, réessayez demain », aucun débit | Règle du code LBA, non documentée ; à confirmer avec le support |
| C20 | Pas d'idempotence sur `apply` | Un envoi accepté (202) n'est jamais rejoué ; sur timeout ou erreur réseau, la candidature passe en statut `unknown` (nouvelle valeur d'enum) et l'étudiant est invité à vérifier son email de confirmation avant de renvoyer | Le rejeu créerait un doublon |
| C21 | CV envoyé | Le CV courant de l'étudiant, PDF, 3 Mo max, encodé `data:application/pdf;base64,...` ; le nom de fichier est nettoyé (`prenom-nom-cv.pdf`) | Contraintes de la route |
| C22 | Lettre de motivation | Transmise dans `applicant_message` (texte), qui est le seul champ prévu ; pas de pièce jointe supplémentaire | Schéma de la route |
| C23 | Téléphone obligatoire | Le numéro de téléphone devient obligatoire dans le profil (format international ou national) | `applicant_phone` requis, formats validés par LBA |
| C24 | Fiche entreprise : recherche | Par SIRET (`q=<siret>`) quand `workplace.siret` est renseigné ; sinon `q=<nom>&code_postal=<cp>` avec un seuil de score et contrôle du nom (normalisation, similarité) ; en dessous du seuil, pas d'affichage | Brief §3.2 |
| C25 | Libellés NAF | Table locale `naf_codes` chargée depuis `docs/reference/naf-rev2-codes-labels.json` | L'API Recherche d'entreprises ne renvoie pas le libellé dans tous les cas |
| C26 | Autocomplétion d'adresse | Route handler serveur `app/api/geocode` (respect de la règle « appels externes côté serveur »), debounce 300 ms, 3 caractères minimum, `limit=5`, `type=municipality` proposé en premier ; la suggestion choisie est revalidée côté serveur (`search` ou `reverse`) avant d'écrire `label`, `lat`, `lng`, `citycode` dans le profil | Convention du brief ; ne jamais faire confiance à des coordonnées venant du navigateur |
| C27 | Code INSEE des arrondissements | `citycode` renvoyé tel quel (ex. `75101`), plus le code commune parent quand il est fourni | Paris / Lyon / Marseille |
| C28 | Validation des codes ROME | Tables `rome_codes` (1 911 fiches) et `rome_appellations` (14 301 appellations) importées depuis l'export CSV officiel de France Travail (ROME 4.0, version 61 « 26M06 », Licence Ouverte), avec la version stockée ; recherche texte Postgres sur les appellations pour proposer des candidats à Haiku, dont la sortie est filtrée par la table (regex `^[A-Z]\d{4}$` + jointure) | L'API Alternance n'a aucune route métiers ; l'ancienne API v1 métiers de LBA a été supprimée le 26 août 2026 ; un code peut changer de sens entre deux versions |
| C29 | Cache des recherches | Table `offer_search_runs` (couple, `fetched_at`, nombre de résultats) pour respecter le TTL de 6 h et suivre les quotas | Brief §3.1 |

### Stack et exploitation

| # | Question | Hypothèse par défaut | Raison |
|---|---|---|---|
| C30 | Node.js | 24.x partout (local et Vercel) ; `engines.node` dans `package.json` | Node 20 déprécié chez Vercel le 1er octobre 2026 |
| C31 | TypeScript | 6.0.x (une seule version pour `tsc` et typescript-eslint) ; passage à TS 7 quand typescript-eslint le supportera | typescript-eslint 8.70 exige `< 6.1` |
| C32 | shadcn/ui | Base UI (défaut depuis juillet 2026), style `new-york`, `baseColor: neutral`, variables CSS | Choix irréversible après `init`, défaut maintenu par shadcn |
| C33 | `cacheComponents` Next.js | Désactivé au MVP | Le pattern Supabase (`cookies()` dans les Server Components) exigerait `<Suspense>` partout |
| C34 | Emails transactionnels (auth) | SMTP par défaut de Supabase en développement ; fournisseur SMTP dédié à choisir avant la bêta (phase 5, accord requis) | ⚠️ Les limites exactes du SMTP par défaut n'ont pas été vérifiées |
| C35 | Playwright et Supabase local | `supabase start` (Docker) + `db reset` + `next build && next start` + `webServer` Playwright ; Docker Desktop ou OrbStack requis sur la machine de l'owner | Composition des docs officielles, à prototyper en phase 4 |
| C36 | Idempotence Stripe | Contrainte unique sur `credit_transactions.stripe_checkout_session_id` + table `stripe_events` (`event.id`) ; traitement de `checkout.session.completed` et `async_payment_succeeded`, vérification de `payment_status` | Doc Stripe (rejeux, désordre) |
| C37 | Fichiers | Bucket privé `documents`, chemin `<user_id>/cv/<uuid>.pdf`, limite 5 Mo par fichier, politiques RLS par dossier ; chiffrement au repos AES-256 selon la déclaration officielle Supabase | Brief RGPD |
| C38 | Région Supabase | UE (Francfort ou Paris selon disponibilité) | RGPD |
| C39 | Modèles Anthropic en configuration | `ANTHROPIC_MODEL_LETTER=claude-sonnet-5`, `ANTHROPIC_MODEL_LIGHT=claude-haiku-4-5-20251001` | Haiku 4.5 peut être retiré à partir du 15 octobre 2026 |
| C40 | Budget de tokens lettre | `max_tokens` 4 096 pour la lettre ; le tokenizer de Sonnet 5 compte environ 30 % de tokens de plus que Sonnet 4.6 | Doc Sonnet 5 |
| C41 | Routes ROME non documentées de La bonne alternance (`/api/rome?title=`) | Non utilisées | Hors documentation et hors CGU |

### Schéma de données (écarts au §4 du brief, appliqués en phase 1)

| # | Question | Hypothèse par défaut | Raison |
|---|---|---|---|
| C42 | `offers.contract_type` est scalaire alors que l'API renvoie un tableau (`Apprentissage`, `Professionnalisation`) | Colonne `contract_types text[]` | Une offre peut porter les deux types |
| C43 | Code INSEE et code postal des offres | L'API Alternance ne fournit ni code INSEE ni code postal séparé : `offers.insee_code` reste nul au MVP (la distance se calcule sur lat/lng) ; ajout de `offers.postal_code`, extrait de l'adresse, nécessaire à la recherche d'entreprise par nom + code postal | Évite un géocodage inverse par offre |
| C44 | Colonnes manquantes de `companies` | Ajout de `date_creation` (demandée au §3.2, absente du §4), `confidence` (score maison de 0 à 1, seuil initial 0,8), `establishment_address`, `establishment_postal_code`, `establishment_city` (lieu de travail, distinct du siège), `naf25_code` (NAF 2025, référence au 1er janvier 2027), `source_updated_at` et `raw` ; `executives` limité à `{ nom, prenoms, qualite }` | `docs/API_RECHERCHE_ENTREPRISES.md` §15 |
| C45 | Référentiel ROME | Tables `rome_versions`, `rome_grand_domaines`, `rome_domaines_professionnels`, `rome_codes`, `rome_appellations` (lecture seule pour les utilisateurs connectés), colonne `profiles.rome_version`, import par `scripts/import-rome.ts` depuis les CSV officiels copiés dans `docs/reference/rome/` | `docs/ROME.md` §11 |
| C46 | Cible d'envoi des offres | `offers.apply_target` contient `apply.recipient_id` pour le canal `api_alternance`, sinon `apply.url` ; `apply.phone` et `identifier.id` restent dans `raw` | `docs/API_ALTERNANCE.md` §18 |
| C47 | Autres ajouts | Valeur `unknown` de `applications.status` (C20), valeurs de `sent_via` listées en C4, compteur de régénérations sur `applications` (C5), tables `offer_search_runs` (C29) et `stripe_events` (C36), statut d'abonnement selon A5 | Regroupés ici pour la migration de la phase 1 |

### Risques mesurés (10 septembre 2026)

| # | Question | Hypothèse par défaut | Raison |
|---|---|---|---|
| C48 | Volume d'offres publiées faible hors des grandes villes | Rayon par défaut de 30 km, modifiable jusqu'à 200 km ; élargissement automatique aux codes ROME voisins du même domaine professionnel quand une recherche renvoie moins de 10 offres ; mesure sur de vrais profils en phase 2, puis décision d'afficher ou non les entreprises qui recrutent sans offre publiée | Mesure F7 : aucune offre en développement à Lyon ni à Angers |
| C49 | Fiche employeur pauvre | La fiche repose sur l'API Recherche d'entreprises ; le résumé du site n'est produit que si une URL est connue ; pour une offre gérée par une école, la fiche le signale et ne présente pas l'école comme l'employeur | Site web connu pour 7 % des offres, 38 % des offres gérées par une école |

### Constats de la phase 1

| # | Question | Hypothèse par défaut | Raison |
|---|---|---|---|
| C50 | Supabase en local | Docker est absent du poste. Avant la phase 2, installer Docker Desktop ou OrbStack (action de l'owner), ou travailler sur un projet Supabase cloud de développement | Les tests de RLS tournent sur PGlite en attendant (B9) |
| C51 | ESLint 9 signalé comme plus maintenu | Rester en ESLint 9 tant que `eslint-config-next` et ses plugins ne déclarent pas ESLint 10 | Éviter un conflit de dépendances |
| C52 | Modèle de l'email de confirmation | Le lien pointe vers `/auth/confirm?token_hash=…` (`supabase/templates/confirmation.html`) ; à recopier dans le projet cloud (Authentication > Email Templates) | Sinon le lien par défaut passe par `/auth/callback`, qui ne fonctionne que dans le même navigateur |
| C53 | Connexion Google | Désactivée dans la configuration locale ; à activer dans le projet cloud avec un client OAuth Google (section D, point 3) | Aucun secret dans le dépôt |

---

### Constats de la phase 2 (11 septembre 2026)

| # | Sujet | Constat ou choix | Effet |
|---|---|---|---|
| C54 | Clé Anthropic absente | L'étape « Domaine recherché » propose alors 8 métiers classés par la recherche dans la nomenclature, le premier coché. Avec `ANTHROPIC_API_KEY`, Haiku choisit parmi 30 candidats officiels et ne peut rien inventer | L'onboarding fonctionne sans clé, avec des suggestions moins fines |
| C55 | Classement des métiers ROME | La première version additionnait les scores de tous les intitulés : « développement » écrasait « web ». Désormais chaque mot pèse selon sa rareté, un métier est classé par son meilleur intitulé et les mots sont réduits à 7 lettres (« développement » trouve « développeur »). Vérifié sur 10 requêtes types avec les données du projet cloud | Migration `20260911110000_rome_search_ranking.sql` |
| C56 | Rafraîchissement sans service de jobs | La recherche d'offres de fin d'onboarding et du bouton « Actualiser » tourne dans la requête (quelques secondes). La synchronisation de fond passe par Supabase Cron (B10) | Rien à configurer en local ; en production, deux secrets dans Vault (`docs/RUNBOOK.md`) |
| C57 | Volume d'offres en informatique | Le 11 septembre, l'API renvoie 0 offre de développement autour de Lyon, même à 100 km, et 9 à Paris, comme en section F point 7. Elle renvoie aussi 150 « recruteurs » : ce sont des entreprises susceptibles de recruter, pas des offres publiées, et Candidatly ne les affiche pas (le brief se limite aux offres publiées) | L'écran vide conseille d'élargir le rayon ou d'ajouter des métiers. Question produit pour plus tard : proposer ou non les candidatures spontanées |
| C58 | Doublons du géocodeur | La Géoplateforme a renvoyé deux fois la même commune pour « Lyon » | Doublons retirés dans `lib/geocoding/geocode.ts` |
| C59 | Documents | CV en PDF uniquement (brief) ; lettre en PDF, Word ou texte collé de 200 caractères minimum. Remplacer un document supprime l'ancien fichier (minimisation). Un PDF sans texte, par exemple un scan, est refusé avec un message | Pas d'OCR au MVP |
| C60 | Filtres de la liste d'offres | Distance, date de publication, entreprise et « offres enregistrées », dans l'URL ; liste limitée aux 300 meilleures correspondances | Aucun état caché côté client |
| C61 | Offres en double dans une réponse | Le 11 septembre, une recherche sur Paris a renvoyé chaque offre France Travail deux fois, avec le même identifiant : 9 résultats pour 5 offres. L'enregistrement échouait (« ON CONFLICT DO UPDATE command cannot affect row a second time ») | Doublons retirés avant l'enregistrement, nombre de doublons dans les logs |

### Constats de la phase 3 (11 septembre 2026)

| # | Sujet | Constat ou choix | Effet |
|---|---|---|---|
| C62 | Cache des recherches d'entreprise | Chaque recherche, trouvée ou non, est gardée 30 jours dans `company_lookups` (clé SIRET, ou nom normalisé et code postal). Chaque passage du cron identifie à l'avance jusqu'à 5 employeurs d'offres récentes ; les autres le sont à la première ouverture de la fiche | Pas de requête répétée vers l'API pour un employeur introuvable |
| C63 | Lecture des sites d'entreprise | Les adresses viennent d'offres tierces : seuls les hôtes publics en http(s), sur les ports standard, sont lus ; les adresses IP, noms locaux et identifiants dans l'URL sont refusés ; chaque redirection est vérifiée et le `robots.txt` de l'hôte final est respecté. Limite acceptée au MVP : le nom de domaine n'est pas résolu pour vérifier qu'il ne pointe pas vers une adresse privée | Risque de requête interne limité, à revoir avant la bêta |
| C64 | Espacement des appels par domaine | Une requête par domaine toutes les 2 s, mémorisée par instance du serveur. Plusieurs instances Vercel pourraient en théorie dépasser ce rythme sur un même domaine ; le volume reste faible (site connu pour 7 % des offres) | À centraliser si le volume grandit |
| C65 | Lettre sans modèle | Les règles remplissent l'objet, les repères [entreprise], [poste] et [ville], une mention « votre entreprise », et ajoutent une phrase sur les compétences que l'offre cite et que le CV liste (liste de compétences de l'offre, sinon ligne « Compétences » du CV retrouvée dans le texte de l'offre). La longueur reste entre 90 et 110 % de la lettre de base ; sinon la phrase n'est pas ajoutée. L'étape 5 de l'inscription conseille d'écrire [entreprise] et [poste] dans la lettre de base | Adaptation modeste mais sans invention ; « Refaire l'adaptation » (3 fois au plus) sert surtout après un changement de lettre de base |
| C66 | Nom de l'employeur dans la lettre | L'orthographe du recruteur dans l'offre est préférée aux capitales du répertoire ; pour une offre gérée par une école, aucun nom n'est inséré | Évite « HOLIS » en capitales et le nom de l'école à la place de l'employeur |

### Constats du MVP (phase 4, 11 septembre 2026)

| # | Sujet | Constat ou choix | Effet |
|---|---|---|---|
| C67 | Envoi sans email | L'étudiant copie sa lettre, candidate sur le site de l'offre, puis confirme dans Candidatly. La candidature passe en « envoyée » (`sent_via = partner_site`), l'offre en « candidature envoyée », une relance est proposée à J+5 avec un message à copier, et la tâche quotidienne passe les candidatures muettes en « sans réponse » à J+14 | Aucun envoi automatique, principe « jamais d'envoi silencieux » respecté |
| C68 | Limite de débit | Compteur par utilisateur et par action en base (`check_rate_limit`, fenêtre fixe) : actualisation des offres 6 par 10 min, suggestion de métiers 20 par 10 min, préparation de candidature 30 par heure, dépôt de document 20 par heure, export 5 par heure, recherche d'adresse 60 par minute. En cas de panne du compteur, l'action passe | Protège les API gratuites et nos coûts sans bloquer les étudiants |
| C69 | Pages légales | Mentions légales, confidentialité et conditions rédigées, avec des repères entre crochets pour l'identité de l'éditeur, le contact et l'adresse de l'hébergeur | À compléter par l'owner et à faire relire par un juriste avant l'ouverture publique |
| C70 | Tests de bout en bout | Playwright sur le build de production et le projet Supabase lié, avec des données de test créées puis supprimées ; l'inscription n'est pas couverte car elle appelle des API externes | Les parcours clés sont vérifiés à chaque exécution de `npm run test:e2e` |
| C71 | Suivi des erreurs | Sentry n'est pas installé : il faut un compte et une clé. Les erreurs restent dans les journaux JSON de Vercel | À ajouter avant l'ouverture publique |
| C72 | Export des données | L'export JSON contient le profil, le texte des documents, les candidatures, les correspondances, les crédits et l'historique ; les fichiers PDF eux-mêmes ne sont pas inclus | Suffisant pour la portabilité au MVP ; téléchargement des fichiers à ajouter si besoin |
| C73 | Preuve sociale de la page d'accueil | L'owner veut afficher « plus de 200 étudiants ont trouvé leur stage et alternance grâce à Candidatly ». Avant le lancement, ce chiffre serait faux, et une allégation chiffrée inexacte est une pratique commerciale trompeuse. La phrase est donc calculée sur les étudiants ayant reçu une réponse positive et s'affiche d'elle-même au-delà de 200 ; avant, « Déjà plus de N étudiants utilisent Candidatly » à partir de 100 inscrits, sinon « Gratuit pendant la bêta » (`lib/social-proof.ts`) | Argument exact à tout moment, sans retouche le jour venu |
| C74 | « Stage » sur la page d'accueil | Les boutons parlent de stage ou d'alternance, à la demande de l'owner, alors que seules les offres d'alternance sont disponibles ; le questionnaire indique « Un stage : offres bientôt disponibles » | À aligner quand les offres de stage arriveront, ou à reformuler si les retours montrent une déception |
| C75 | Connexion Google | Le 11 septembre 2026, Google est désactivé dans le projet Supabase : le bouton menait à une erreur. Il ne s'affiche désormais que si Supabase annonce Google comme actif (réglages publics de l'authentification, cache de 5 minutes), et le retour après connexion vise le site où se trouve l'étudiant plutôt que `NEXT_PUBLIC_SITE_URL`. L'activation demande un client OAuth Google créé par l'owner (`docs/RUNBOOK.md`) | La connexion par email reste disponible ; Google apparaîtra dès son activation |

## D. Comptes et accès à préparer (owner)

Aucun n'est nécessaire pour démarrer la phase 1 (Supabase local + réponses mockées), mais tous le sont avant la phase 2.

1. **API Alternance** (jeton production créé le 10 septembre 2026, rangé dans `.env.local`, échéance dans `docs/RUNBOOK.md`) : compte sur `https://api.apprentissage.beta.gouv.fr` (inscription gratuite par lien envoyé par email), puis deux jetons de 365 jours, non prolongeables. Un jeton **production** dans `API_ALTERNANCE_KEY` : la lecture des offres réelles ne demande aucune habilitation, alors qu'un jeton sandbox renvoie les offres de l'environnement de test, même en lecture. Un jeton **sandbox** dans `API_ALTERNANCE_SANDBOX_KEY` pour tester l'envoi de candidatures. Ne jamais partager un jeton (interdit par les CGU).
2. **Supabase** : projet cloud en région UE ; noter l'URL, la clé publishable et la clé secret.
3. **Google Cloud** : client OAuth 2.0 (type Web), URI de redirection `https://<project-ref>.supabase.co/auth/v1/callback`, écran de consentement ; client ID et secret à saisir dans Supabase Auth.
4. **Anthropic** : clé API dans `ANTHROPIC_API_KEY`, limite de dépense mensuelle configurée.
5. **Stripe** : compte en mode test (clés `sk_test_...`, secret de webhook), trois produits / prix pour les packs ; le passage en mode live exige une entité juridique.
6. **Tâches planifiées** : plus de compte Trigger.dev à créer (B10). En production, `CRON_SECRET` dans Vercel et deux secrets dans Supabase Vault (`docs/RUNBOOK.md`).
7. **Vercel** : projet lié au dépôt, Node 24.
8. **Machine locale** : Docker Desktop ou OrbStack pour `supabase start`, Stripe CLI.

---

## E. Versions et écarts de stack

Vérifiées le 9 septembre 2026 (`npm view <pkg> version` et documentation officielle). Le tableau des versions cibles est dans `CLAUDE.md` section 8. Points qui changent la manière de coder par rapport à un projet de 2025 :

- **Next.js 16.3** : `cookies()`, `headers()`, `params`, `searchParams` sont asynchrones ; `middleware.ts` devient `proxy.ts` (Node.js uniquement) ; Turbopack par défaut ; `next lint` supprimé (ESLint flat config appelé directement) ; `revalidateTag` prend un second argument ; `create-next-app` génère un `AGENTS.md` qui référence `CLAUDE.md`.
- **Supabase** : `@supabase/ssr` avec `getAll` / `setAll`, `getClaims()` dans le proxy (jamais `getSession()` côté serveur), `getUser()` quand il faut vérifier une déconnexion serveur ; `supabase-js` exige Node >= 22.
- **Trigger.dev 4.5**, retiré du projet le 11 septembre 2026 (B10) : `import { task, schedules } from "@trigger.dev/sdk"`, `schemaTask` + Zod, `idempotencyKey` (portée `run` par défaut depuis 4.3.1), files prédéfinies avec `queue()`, cron avec fuseau `Europe/Paris`.
- **Anthropic SDK 0.124** : structured outputs GA (`output_config.format`, helper `zodOutputFormat`, `client.messages.parse`), pas de contraintes numériques ni de longueur dans la grammaire (validées par Zod après coup), prompt caching à partir de 1 024 tokens (Sonnet 5) ou 4 096 (Haiku 4.5).
- **Stripe 22.6** : `new Stripe(secret)` (classe), `request.text()` pour le corps brut du webhook, `constructEvent`, `Idempotency-Key` sur la création de session.
- **Zod 4.5** : `import * as z from "zod"`, `z.email()`, `error:` au lieu de `message:`, `z.treeifyError()`.
- **Vitest 5** : `vi.mock` au niveau racine, `clearMocks` par défaut, Node >= 22.12.
- **TypeScript 7** est sorti (port natif) mais sans API programmatique stable ; typescript-eslint reste sur TS 6 (C31).

---

## F. Vérifications sur données réelles

Faites le 10 septembre 2026 avec le jeton production. Détail dans `docs/API_ALTERNANCE.md`, section 0.

1. Part des offres candidatables par l'API : 46 % (69 sur 151). Toutes les offres déposées sur La bonne alternance le sont, aucune offre France Travail, Meteojob, RH Alternance ou iquesta.
2. Ordre des coordonnées : `[longitude, latitude]` sur les 204 offres reçues.
3. Offres France Travail : toutes ont un `identifier.id`, aucune n'a de `recipient_id`.
4. En-têtes de quota présents sur une recherche authentifiée : `x-ratelimit-limit: 60`, `x-ratelimit-remaining`, `x-ratelimit-reset`. Aucun 429 n'a été provoqué.
5. Route de candidature en environnement de test : à faire avec un jeton sandbox, pas encore créé.
6. Nombre de codes ROME par requête : 20, 21 et 30 codes acceptés.
7. Volumes d'offres publiées, rayon de 30 km, trois codes ROME par domaine :

| Zone | Développement informatique | Commerce et marketing | Comptabilité et RH |
|---|---|---|---|
| Paris | 9 | 46 | 124 |
| Lyon | 0 | 9 | 12 |
| Angers | 0 | 0 | 0 |
| Guéret | 0 | 0 | 4 |

8. Sans réponse, faute de contact avec le support par décision de l'owner : limite de 20 candidatures par jour et par SIRET pour une organisation, engagement de maintien de la route de candidature, conservation des données.
