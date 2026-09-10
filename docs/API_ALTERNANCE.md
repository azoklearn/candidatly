# API Alternance (api.apprentissage.beta.gouv.fr)

Dernière vérification : 8 septembre 2026 (spécification OpenAPI `a18de31` sauvegardée dans `docs/reference/` le 8 septembre 2026 ; appels de contrôle sans clé, lecture des pages du portail et du code source public rejoués le 9 septembre 2026).

Document de référence pour l'intégration de l'API Alternance dans Candidatly (brief §3.1, §4 et §6). Il doit permettre d'implémenter `lib/providers/api-alternance.ts`, les jobs `sync-offers` et `send-application` et le schéma Zod de réponse sans rouvrir la documentation externe.

Conventions de lecture :

- « (spec) » : information issue de la spécification OpenAPI 3.1.0 servie par le portail, identique octet pour octet au fichier `docs/reference/api-alternance.openapi.json` (sha256 `ca171372181ae3f696bdcfb069b37a31345b516735dded7b097216ee88f4ce2e`, 117 426 octets, `info.version = "a18de31"`). La variante française `docs/reference/api-alternance.openapi.fr.json` porte les mêmes schémas avec les descriptions en français (le paramètre `?lang=fr` et l'en-tête `Accept-Language: fr` renvoient aujourd'hui la version anglaise, la copie FR reste donc utile).
- « (code) » : comportement observé dans le code source public des dépôts `mission-apprentissage/api-apprentissage` (portail et proxy) et `mission-apprentissage/labonnealternance` (moteur réel des offres et des candidatures) sur la branche `main` au 9 septembre 2026. Ce comportement n'est pas contractuel et peut changer sans préavis.
- « (observé) » : réponse HTTP réellement obtenue le 9 septembre 2026, sans clé API.
- « ⚠️ Non vérifié : » : affirmation qui n'a pas pu être confirmée sur une source primaire. Ne pas l'implémenter à l'aveugle ; voir la section « Points restant à vérifier ».

Aucun compte n'a été créé, aucune clé demandée, aucune candidature envoyée pendant la phase 0.

## Résumé en 5 points

1. **Une seule URL, une clé gratuite, un environnement porté par la clé.** Base `https://api.apprentissage.beta.gouv.fr/api`, en-tête `Authorization: Bearer <clé>`. Le compte se crée par lien magique e-mail, le jeton vit 365 jours et n'est pas prolongeable. Une clé de type `sandbox` (défaut à la création) route **tous** les échanges avec La bonne alternance, lectures comprises, vers l'environnement de recette ; pour lire les offres réelles il faut une clé `production`.
2. **Trois routes pour Candidatly, plus une alternative.** `GET /job/v1/search` (60 appels/min, 150 offres maximum par source, aucune pagination), `GET /job/v1/offer/{id}` (120/min), `POST /job/v1/apply` (10/min, réponse `202 { id }`, habilitation `applications:write` accordée d'office en sandbox et sur demande e-mail en production). `GET /job/v1/export` (2/min) fournit un dump quotidien de toutes les opportunités, utilisable comme source principale de `sync-offers`.
3. **Candidatable ou non : le champ `apply.recipient_id`.** S'il est non nul, la candidature passe par l'API (canal `api_alternance`) ; sinon, seule la redirection vers `apply.url` reste possible (canal `external_url`). Les offres France Travail n'exposent pas de `recipient_id`. Aucune route de lecture de candidature, aucun webhook, aucun callback : le suivi « vue / réponse » du brief ne peut être alimenté que manuellement.
4. **Garde-fous côté La bonne alternance (code), non documentés publiquement.** 3 candidatures maximum par candidat et par offre, 20 par jour par organisation consommatrice et par SIRET, 100 par jour par candidat, clôture automatique d'une offre à 80 candidatures. Aucune clé d'idempotence : ne jamais rejouer un envoi après un 202 ou un timeout.
5. **Point bloquant juridique.** Les pages officielles du portail réservent l'API à des « usages non lucratifs », interdisent « la facturation de l'accès pour des tiers comme des candidats » et refusent l'habilitation d'envoi pour un « usage individuel ». Les CGU interdisent de « commercialiser les données reçues ». Le modèle « 1 crédit = 1 envoi » doit être validé par écrit avec `support_api@apprentissage.beta.gouv.fr` avant de construire sur ces données en phase 2 (voir §15 et `docs/QUESTIONS.md`, A1).

## 1. Architecture et sources primaires

### 1.1 L'API Alternance est un proxy vers La bonne alternance

L'« Espace développeurs La bonne alternance » (`api.apprentissage.beta.gouv.fr`) n'héberge pas les offres. Chaque route `/job/v1/*` est transférée vers le site La bonne alternance (LBA), qui exécute réellement la recherche et la candidature (code, `server/src/server/routes/job/job.routes.ts`) :

| Route publique (API Alternance) | Route interne LBA | Habilitation |
|---|---|---|
| `GET /job/v1/search` | `GET /v3/jobs/search` | aucune (clé suffisante) |
| `GET /job/v1/offer/{id}` | `GET /v3/jobs/:id` | aucune |
| `GET /job/v1/offer/{id}/publishing-informations` | `GET /v3/jobs/:id/publishing-informations` | aucune |
| `GET /job/v1/export` | `GET /v3/jobs/export` | aucune |
| `POST /job/v1/offer`, `PUT /job/v1/offer/{id}` | `POST /v3/jobs`, `PUT /v3/jobs/:id` | `jobs:write` (hors périmètre) |
| `POST /job/v1/apply` | `POST /v2/application` | `applications:write` |

Conséquences : les schémas, les limites métier et les messages d'erreur « réels » sont dans le dépôt `labonnealternance` ; le proxy ajoute l'authentification, le rate limiting par clé et un timeout de 10 s (code, §5.3). Les descriptions de la spécification contiennent quelques reliquats de chemins internes (par exemple « /v3/jobs/apply » dans la description de `apply.recipient_id`) : la route publique est toujours `/job/v1/apply`.

### 1.2 Spécification, code, documentation

- Spécification OpenAPI : `https://api.apprentissage.beta.gouv.fr/api/documentation/json` (rendu Redoc sur `/fr/documentation-technique`). `info.version = "a18de31"` correspond au commit `a18de31` du 1er septembre 2026 du dépôt `api-apprentissage` (« fix: clarifier le calcul de la géolocalisation des offres déposées (lba-5081) »). `GET /api/healthcheck` renvoie la même version.
- Génération de la spécification : `shared/src/openapi/generateOpenapi.ts` (importé par `server/src/server/server.ts`) assemble les fragments OpenAPI des modèles (`sdk/src/models/**/*.model.openapi.ts`) et les définitions de routes du SDK ; la documentation textuelle des routes vit dans `sdk/src/docs` (292 fichiers). Le dépôt ne contient pas de fichier CHANGELOG (code).
- Code source (licence MIT) : `github.com/mission-apprentissage/api-apprentissage` (dernier push le 8 septembre 2026) et `github.com/mission-apprentissage/labonnealternance` (version en production `1.899.1` d'après `GET /api/version`).
- Métadonnées de la spécification : `info.license = Etalab-2.0` (`https://github.com/etalab/licence-ouverte/blob/master/LO.md`), `info.termsOfService = https://api.apprentissage.beta.gouv.fr/cgu`, `info.contact = support_api@apprentissage.beta.gouv.fr` (« Équipe Espace développeurs La bonne alternance »).
- Pages « explorer » (`/fr/explorer/recherche-offre`, `/fr/explorer/recuperation-detail-offre`, `/fr/explorer/candidature-offre`) : application Next.js dont le contenu métier est rendu côté serveur ; les textes cités dans ce document ont été extraits du HTML servi.
- SDK officiel : paquet npm `api-alternance-sdk`, `new ApiClient({ key })`, méthodes génériques `get`, `post`, `put`, `delete` et modules `organisme`, `certification`, `geographie` ; aucun module dédié aux offres ni aux candidatures (`apiClient.post("/job/v1/apply", body)` reste possible). Le README est contradictoire sur la version de Node (« NodeJs 22+ » en ligne 3, « NodeJs 24+ : nous utilisons l'api fetch en natif » en ligne 7). Candidatly n'en a pas besoin : un client `fetch` maison avec schéma Zod suffit et permet l'injection de `fetch` pour les tests.

## 2. Compte, clé API et environnements

### 2.1 Création du compte

- Page `https://api.apprentissage.beta.gouv.fr/fr/compte/profil`, bouton « Se connecter / S'inscrire ». Texte exact de la modale (fichier i18n `inscription-connexion.json`, clé `envoiLienDescription`) : « Obtenez et gérez vos jetons d'accès à l'espace développeurs La bonne alternance. Renseignez votre adresse email, en privilégiant une adresse professionnelle. […] Nous vous enverrons un lien qui vous permettra de vous connecter à votre compte ou de vous inscrire, sans mot de passe ». Connexion par lien magique e-mail, sans mot de passe.
- CGU art. 1 : « L'inscription est gratuite et ouverte à tous. » Art. 3 : l'« Utilisateur » désigne « toute personne physique » (le compte est nominatif). Art. 4 : inscription avec l'adresse e-mail, réception d'un lien de connexion, puis « Un code technique d'accès est créé à l'Utilisateur ».
- Le modèle utilisateur (code, `shared/src/models/user.model.ts`) impose `cgu_accepted_at`, un `type` parmi `operateur_public`, `organisme_formation`, `entreprise`, `editeur_logiciel`, `apprenant`, `autre`, un prénom, un nom et une description : l'inscription demande d'accepter les CGU et de qualifier son profil.
- Aucun délai d'approbation pour la lecture : les routes de recherche, de détail et d'export ont `access: null` (code, `sdk/src/routes/jobs/job.routes.ts`). Une clé valide suffit. Le brief (« clé API gratuite ») est confirmé.

### 2.2 Génération et cycle de vie du jeton

- Sur la page profil, modale « Générer un jeton » : un champ **nom** (facultatif ; un nom vide est remplacé par un nom aléatoire adjectif-couleur-animal, code) et un choix de **type** : « Sandbox - pour tester votre intégration » (défaut) ou « Production ». Appel interne `POST /_private/user/api-key`, body `{ name, env }`, `env` par défaut `"sandbox"` (code).
- Textes du portail : « Tous les jetons d'accès ont une durée de vie de 365 jours ; » « 1 mois avant l'expiration, vous serez invité à en créer un nouveau pour prolonger votre usage ; » « Il n'est pas possible de prolonger la durée de vie d'un jeton. » Côté serveur : `api_key.expiresIn = 365 * 24 * 60 * 60 * 1000` (commentaire « 1 an ») et un job envoie un e-mail `api-key-will-expire` à J-30 puis J-15 (code).
- Le jeton reste consultable après création : la liste des clés de la page profil ré-émet la valeur de chaque clé non expirée (`value` vaut `null` seulement quand `expires_at` est dépassé). Le jeton est un JWT signé dont le payload contient `_id`, `api_key`, `organisation`, `email` et `env` (claim informatif, la source de vérité est la clé en base) (code, `server/src/actions/users.actions.ts`).
- Un utilisateur peut détenir plusieurs clés (`api_keys: array`, champs `name`, `key`, `env`, `last_used_at`, `expires_at`, `created_at`, `expiration_warning_sent`) (code).
- Migration `20260825120000-api-key-env.ts` : toutes les clés créées avant le 25 août 2026 ont été étiquetées `production` (code).
- Pour Candidatly : variable `API_ALTERNANCE_KEY` (clé production, lecture) et clé sandbox distincte pour les tests d'envoi (`API_ALTERNANCE_SANDBOX_KEY`) ; noter la date d'expiration dans `docs/RUNBOOK.md` et prévoir la rotation annuelle.

### 2.3 Sandbox et production

Documenté dans `info.description` de la spécification depuis la release `sdk@2.17.0` du 28 août 2026 (« Support des clés API sandbox », « Aucun changement cassant ») :

> « L'environnement est porté par le type de votre clé API (choisi à la création, sur votre compte), pas par l'URL : dans les deux cas, ciblez `https://api.apprentissage.beta.gouv.fr/api`. »

| | Clé `sandbox` | Clé `production` |
|---|---|---|
| Habilitations d'écriture (`jobs:write`, `appointments:write`, `applications:write`) | Accordées automatiquement | Sur demande au support |
| Échanges La bonne alternance (recherche et dépôt d'offres, candidatures, rendez-vous) | Environnement de test (`labonnealternance-recette.apprentissage.beta.gouv.fr`) | Production |
| Autres données (certifications, formations, organismes, géographie) | Identiques à la production | Production |

> « Avec une clé sandbox, vos dépôts d'offres, candidatures et prises de rendez-vous sont routés vers l'environnement de recette de labonnealternance-recette.apprentissage.beta.gouv.fr […] rien de ce que vous envoyez n'est visible par de vrais candidats ou employeurs. »

Points importants (code) :

- Commentaire de `sdk/src/routes/security/permissions.ts` : « côté données, TOUT le forward LBA (y compris les lectures /job) cible l'environnement de la clé ». **Une clé sandbox renvoie donc les offres de l'environnement de recette pour `/job/v1/search`, pas les offres réelles.** Développer `sync-offers` sur données réelles exige une clé production (lecture sans habilitation) ; tester l'envoi sans habilitation exige une clé sandbox.
- Le proxy choisit l'endpoint LBA selon `api_key.env` (`endpoint_sandbox` ou `endpoint`) et signe un JWT interne avec une clé privée distincte pour la sandbox ; toutes les habilitations sont mises à `true` dans le jeton sandbox ; un utilisateur sans organisation est accepté et LBA reçoit comme `caller` le label synthétique `sandbox:<email>` (`forwardApi.service.ts`).
- Page explorer de la candidature : « Pour tester sans habilitation, utilisez un jeton de type sandbox : les échanges partent vers un environnement de test ».
- ⚠️ Non vérifié : le comportement des e-mails en sandbox (les candidatures envoyées en recette déclenchent-elles réellement des e-mails, vers quelle boîte) n'est pas documenté ; le service candidature de LBA ne distingue pas recette et production, tout dépend de la configuration SMTP de l'environnement de recette.

### 2.4 Habilitations

- Description du schéma de sécurité (spec, FR) : « Clé d'API à fournir dans le header `Authorization`. Si la route nécessite une habilitation particulière, une clé de type sandbox l'obtient automatiquement […] ; pour une clé de type production, veuillez contacter le support pour en faire la demande à support_api@apprentissage.beta.gouv.fr ».
- Les habilitations sont portées par l'**organisation** de l'utilisateur (code, `authorisationService.ts`). Avec une clé production, un utilisateur sans organisation ou dont l'organisation n'a pas `applications:write` reçoit `403 {"statusCode":403,"name":"Forbidden","message":"Vous n'êtes pas autorisé à accéder à cette ressource"}` (test `job.route.test.ts`).
- Le portail génère un mailto pré-rempli : sujet « Demande d'habilitation pour l'envoi de candidature aux opportunités d'emploi en alternance », corps « Bonjour, je souhaite obtenir une habilitation pour envoyer des candidature à des offres d'emploi en alternance sur la plateforme La bonne alternance. » (code, `sdk/src/openapi/openapiSpec.ts`).
- Page explorer de la candidature (texte exact) : « **Cette API est réservée aux services traitant un volume important de candidatures. Les demandes d'habilitation pour un usage individuel ne seront pas accordées.** » Aucun palier de quota ni statut « partenaire » n'est documenté ; la spécification dit seulement « Si vos volumes nécessitent des limites supérieures, contactez support_api@apprentissage.beta.gouv.fr ».

## 3. Authentification

- Schéma `components.securitySchemes["api-key"]` : `type: http`, `scheme: bearer`, `bearerFormat: Bearer` (spec). En-tête : `Authorization: Bearer <clé>`.
- Seule `/healthcheck` est publique (`security: []`). Toutes les routes `/job/v1/*` exigent la clé ; `POST /job/v1/offer` et `PUT /job/v1/offer/{id}` exigent en plus `jobs:write`, `POST /job/v1/apply` exige `applications:write` (spec et code).
- Sans clé (observé, `GET /api/job/v1/search?romes=M1805` et `POST /api/job/v1/apply`) :

```json
{"statusCode":401,"name":"Unauthorized","message":"Vous devez fournir une clé d'API valide pour accéder à cette ressource"}
```

- Clé invalide (code, test du dépôt) : `401 {"statusCode":401,"name":"Unauthorized","message":"Impossible de déchiffrer la clé d'API"}`.
- Aucun en-tête `x-ratelimit-*` ni `retry-after` n'est présent sur les réponses 401 (observé) : le rate limiter est branché en hook `preHandler`, après l'authentification (code). Ces en-têtes ne sont attendus que sur les réponses authentifiées.
- Contrôle de santé sans clé (observé) : `GET https://api.apprentissage.beta.gouv.fr/api/healthcheck` renvoie `{"name":"Espace développeurs La bonne alternance","version":"a18de31","env":"production"}` (`env` est un enum `local`, `recette`, `production`, `preview`, `test`, spec).

## 4. URL de base, versionnement, statut du service

### 4.1 URL de base et routes exposées

`servers[0].url = https://api.apprentissage.beta.gouv.fr/api` (description « production », spec). La spécification expose 16 chemins plus le healthcheck :

| Ressource | Routes |
|---|---|
| Job (offres) | `GET /job/v1/search`, `GET /job/v1/offer/{id}`, `GET /job/v1/offer/{id}/publishing-informations`, `GET /job/v1/export`, `POST /job/v1/offer`, `PUT /job/v1/offer/{id}`, `POST /job/v1/apply` |
| Certification | `GET /certification/v1` |
| Formation | `GET /formation/v1/search`, `GET /formation/v1/{id}`, `POST /formation/v1/appointment/generate-link` |
| Organisme | `GET /organisme/v1/recherche`, `GET /organisme/v1/export` |
| Géographie | `GET /geographie/v1/commune/search`, `GET /geographie/v1/departement`, `GET /geographie/v1/mission-locale` |
| Santé | `GET /healthcheck` |

Aucune route de lecture, de statut ou de suivi de candidature, aucun webhook (spec).

### 4.2 Versionnement et dépréciations

- Versionnement par ressource dans le chemin (`/job/v1/…`). Il n'existe ni `/job/v2` ni `/v3` sur `api.apprentissage` ; les mentions « /v3/jobs/… » des descriptions renvoient aux chemins internes de LBA.
- Seule marque « Deprecated » de la spécification : le champ `JobOfferWrite.offer.origin` (route de dépôt d'offres, hors périmètre).
- ⚠️ Non vérifié : la spécification définit un tag « Experimental » (« ces routes peuvent changer sans préavis ») mais aucun chemin ne le porte dans la version `a18de31`.

### 4.3 Historique des changements

Le portail ne publie pas de changelog, mais le dépôt GitHub publie des **releases avec notes** (tags `sdk@x.y.z`) : c'est le canal à surveiller (`https://github.com/mission-apprentissage/api-apprentissage/releases`).

| Release | Date | Contenu |
|---|---|---|
| `sdk@2.15.0-rc.1` | 2026-01-19 | |
| `sdk@2.15.1` | 2026-03-03 | |
| `sdk@2.16.1`, `sdk@2.16.2` | 2026-06-11 | « rate-limit par consommateur sur les routes forwardées vers LBA » (issue #4806) et « ajouter un timeout sur les requêtes forwardées vers LBA » |
| `sdk@2.17.0` | 2026-08-28 | « Support des clés API sandbox », « Aucun changement cassant » (PR #510 du 27 août 2026) |

La version de l'API en production est un SHA git (`a18de31`) exposé par `/api/healthcheck` et `info.version`.

### 4.4 Statut du produit et disponibilité

- Fiche beta.gouv.fr « API Apprentissage » : construction depuis le 1er septembre 2023, phase « Arrêté » depuis le 1er avril 2024 : « Le produit reste accessible mais n'est plus piloté comme une startup d'Etat depuis mars 2024. Il intègre les activités des équipes de La bonne alternance et du Tableau de bord de l'apprentissage. » Les releases de juin et août 2026 et les CGU v1.0 de mars 2025 montrent que le service est activement maintenu.
- Page de statut : le lien « Status » du portail (`https://mission-apprentissage.github.io/upptime/history/api-apprentissage-api`) répond 404 ; la racine `https://mission-apprentissage.github.io/upptime/` répond 200 et le README du dépôt `mission-apprentissage/upptime` indique pour le moniteur « API Apprentissage - API » (`/api/healthcheck`) une disponibilité de 99,97 % depuis l'origine et 99,98 % sur un an (temps de réponse moyen 7 jours : 790 ms) ; « La bonne alternance API » : 99,81 % depuis l'origine, 99,96 % sur un an.
- Fiche data.gouv.fr (`dataservices/672cf64ff8b5d52b76263394`, créée le 7 novembre 2024, organisation DINUM) : accès `open_with_account`, gratuit, disponibilité affichée 98,82 %, contact `contact@labonnealternance.apprentissage.beta.gouv.fr` (différent du `support_api@` de la spécification). La page web affiche la licence « Open Licence 2.0 » alors que le JSON de l'API data.gouv a `license: null`. Elle annonce un rate limiting « de 5 à 20 appels / seconde. Les quotas diffèrent en fonction des routes », incohérent avec la spécification (60/min sur la recherche) : **la spécification fait foi**.
- Contacts : `support_api@apprentissage.beta.gouv.fr` (habilitations, quotas, contact OpenAPI), `api@apprentissage.beta.gouv.fr` (politique de confidentialité du portail, fiche beta.gouv), `contact@labonnealternance.apprentissage.beta.gouv.fr` (LBA, data.gouv.fr, DPO).

### 4.5 API historique de La bonne alternance : ne plus l'utiliser

Vérifications du 9 septembre 2026 (observé) sur `labonnealternance.apprentissage.beta.gouv.fr` :

- `/api/v1/jobs`, `/api/v1/jobsEtFormations`, `/api/v1/formations`, `/api/v2/jobs`, `/api-docs`, `/api/v1/docs` : **404**.
- `/api/v3/jobs/search` et `/api/v3/jobs/export` : **401** `{"statusCode":401,"error":"Unauthorized","message":"Unable to parse token missing-bearer"}` (authentification interne par jeton émis par le proxy, inutilisable directement).
- `/api/healthcheck` OK, `/api/version` → `1.899.1`.
- La page `/espace-developpeurs` ne fait que renvoyer vers `api.apprentissage.beta.gouv.fr/fr/explorer`, `/fr/documentation-technique`, le widget (`api.gouv.fr/guides/widget-la-bonne-alternance`) et le dépôt d'offres.
- ⚠️ Non vérifié : aucun avis de dépréciation daté n'a été trouvé ; le `server/CHANGELOG.md` de LBA s'arrête à la version 1.20.9 (27 septembre 2022) et mentionne encore l'ancienne documentation `/api/V1/jobs`, `/api/V1/jobsEtFormations`, `/api/V1/formationsParRegion`.

Conclusion : utiliser exclusivement `https://api.apprentissage.beta.gouv.fr/api/job/v1/*`.

## 5. Format des erreurs, rate limiting et quotas

### 5.1 Format d'erreur commun (spec)

```json
{ "statusCode": 400, "name": "Bad Request", "message": "Request validation failed", "data": { } }
```

`{ statusCode: number, name: string, message: string, data?: any }`, `additionalProperties: false`. Le corps réel du 401 respecte ce format (observé).

**Exceptions à prévoir dans le parseur d'erreur** (code) :

- Le rate limiter du proxy renvoie `{ "statusCode": 429, "error": "Too Many Requests", "message": "Quota dépassé : <max> requêtes par <fenêtre>. Voir https://api.apprentissage.beta.gouv.fr/documentation pour les limites par endpoint." }` : clé `error`, pas `name`.
- Les 429 métier de LBA (§11.2) sont des erreurs `@hapi/boom` relayées telles quelles par le proxy. ⚠️ Non vérifié : leur corps est inféré du framework, `{ "statusCode": 429, "error": "Too Many Requests", "message": "<code métier>" }`, non observé.

Le parseur doit donc accepter `name` ou `error` et ne jamais dépendre du texte de `message`.

### 5.2 Codes HTTP

| Code | Cas documenté (spec) | Comportement réel (code, observé) |
|---|---|---|
| 400 | « Request validation failed » (erreurs Zod du proxy, détail dans `data`) | Aussi les erreurs métier LBA sur `apply` (§10.4) et les codes ROME mal formés sur `search` (§6.1) ; un `id` non ObjectId sur `/offer/{id}` |
| 401 | Clé absente ou invalide | Messages « Vous devez fournir une clé d'API valide… » (observé) ou « Impossible de déchiffrer la clé d'API » |
| 403 | « Habilitations insuffisantes pour accéder à la ressource » | « Vous n'êtes pas autorisé à accéder à cette ressource » |
| 404 | « Ressource non trouvée » | `/offer/{id}` inconnu : « Aucune offre d'emploi trouvée pour l'ID: … » avec warning `JOB_NOT_FOUND`. Sur `apply`, une offre inconnue produit un **400** « Job or recruiter not found », pas un 404 |
| 409 | « La ressource exite déjà » (coquille dans la spec) | Aucun cas connu sur les routes utilisées |
| 419 | `TooManyRequests` (`statusCode enum [419]`, exemple « Limite de requêtes atteinte ») | **Artefact de documentation** : le serveur émet 429. Tolérer 419 comme 429 |
| 429 | Politique de rate limiting de `info.description` | Émis par le proxy (quota par clé) et relayé depuis LBA (quotas métier) |
| 500 | « Une erreur inattendue s'est produite sur le serveur. » | Aussi un 401 renvoyé par LBA au proxy, converti en 500 |
| 502 | « Le service est indisponible. » | |
| 503 | « Le service est en maintenance » | Le schéma porte par erreur `statusCode enum [502]` |
| 504 | Non documenté | Timeout de 10 s du forward vers LBA (`gatewayTimeout`) |

### 5.3 Rate limiting

Politique générale (spec, `info.description`) : limite **par consommateur (clé API)**, indiquée dans la description de chaque route. En-têtes annoncés sur chaque réponse authentifiée : `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset` (secondes) et `retry-after` sur 429. « Lorsque votre quota est atteint, l'API renvoie un code HTTP 429 - Too Many Requests avec un corps JSON ». Bonnes pratiques recommandées : surveiller `x-ratelimit-remaining`, réessayer avec un backoff exponentiel en respectant `retry-after`, contacter le support pour des limites supérieures. ⚠️ Non vérifié : la présence effective des en-têtes `x-ratelimit-*` sur les réponses authentifiées n'a pas pu être observée sans clé.

Implémentation (code, `@fastify/rate-limit`, fenêtre glissante d'une minute, clé de comptage `api_key:<id>`, sinon `user:<email>`, sinon `ip:<ip>`). Le plugin est enregistré avec `global: false` : seules les routes portant `config.rateLimit` sont limitées.

| Route | Limite (spec et code) |
|---|---|
| `GET /job/v1/search` | 60 appels/min |
| `GET /job/v1/offer/{id}` et `GET /job/v1/offer/{id}/publishing-informations` | 120 appels/min, limite partagée |
| `GET /job/v1/export` | 2 appels/min |
| `POST /job/v1/apply` | 10 appels/min |
| `POST /job/v1/offer`, `PUT /job/v1/offer/{id}` | 30 appels/min (code) |
| `POST /formation/v1/appointment/generate-link` | 10 appels/min (code) |
| `/certification/v1`, `/formation/v1/search`, `/formation/v1/{id}`, `/geographie/*`, `/organisme/*`, `/healthcheck` | aucune limite côté serveur (code) |

Le rate limit par consommateur sur les routes forwardées date de la release `sdk@2.16.2` (11 juin 2026).

### 5.4 Stratégie de retry pour Candidatly

- Lectures (`search`, `offer`, `export`) : retry avec backoff exponentiel sur 429, 419, 502, 503, 504 et erreurs réseau, en respectant `retry-after` ; `sync-offers` à 60 appels/min, viser au plus 1 requête par seconde par sécurité.
- Écriture (`apply`) : **jamais de rejeu automatique** après un 202, un 504, un timeout client ou une erreur réseau (la candidature a pu être enregistrée). Rejouer uniquement sur 429 du proxy après `retry-after`, et sur 401/403/400 remonter l'erreur à l'utilisateur (voir `AbortTaskRunError` dans les conventions).

## 6. Recherche : `GET /job/v1/search`

Description (spec) : « Accéder en temps réel à toutes les opportunités d'emploi en apprentissage disponibles en France et proposez-les à vos utilisateurs gratuitement et sous un format white-label. Limite de débit : 60 appels par minute, par consommateur. » Page explorer : fréquence de mise à jour « TOUS LES JOURS ».

### 6.1 Paramètres de requête (tous `in: query`, tous optionnels)

| Paramètre | Type | Obligatoire | Valeurs / contraintes | Remarques |
|---|---|---|---|---|
| `romes` | string | non | Codes ROME séparés par des virgules, chaque code au format `^[A-Z]\d{4}$`. Exemples : `F1601,F1201,F1106`, `M1806` | Côté LBA : `split(",")`, trim, test de chaque code ; sinon 400 « One or more ROME codes are invalid. Expected format is 'D1234'. » (code). Aucune limite de nombre de codes dans la doc ni dans le code ; 2 à 5 codes (brief) sans risque a priori |
| `rncp` | string | non | Un seul code, pattern `^RNCP\d{3,5}$`. Exemples : `RNCP34436`, `RNCP183` | |
| `latitude` | number | non, mais obligatoire si `longitude` est fourni | -90 à 90 | Sans lat/lon, la recherche couvre toute la France. LBA renvoie 400 « longitude is required when latitude is provided » (et inversement) (code) |
| `longitude` | number | non, mais obligatoire si `latitude` est fourni | -180 à 180 | **Les exemples de la spécification sont inversés** (`longitude` 48.8566, `latitude` 2.3522) et la description de `latitude` est copiée sur celle de `longitude`. Paris = `latitude=48.8566&longitude=2.3522` |
| `radius` | number | non | 0 à 200, défaut 30 | Rayon en km, utile si lat/lon fournis. Le brief prévoit `search_radius_km` défaut 30 |
| `target_diploma_level` | string | non | `"3"`, `"4"`, `"5"`, `"6"`, `"7"` | Filtre inclusif, voir §12 |
| `opco` | string | non | `AFDAS`, `AKTO / Opco entreprises et salariés des services à forte intensité de main d'oeuvre`, `ATLAS`, `Constructys`, `L'Opcommerce`, `OCAPIAT`, `OPCO 2i`, `Opco entreprises de proximité`, `Opco Mobilités`, `Opco Santé`, `Uniformation, l'Opco de la Cohésion sociale` | Enum de 11 valeurs |
| `departements` | string[] | non | Numéros de département, paramètre répété : `departements=75&departements=06` | |
| `partners_to_exclude` | string[] | non | Libellés de partenaires, paramètre répété : `partners_to_exclude=Hellowork&partners_to_exclude=RH Alternance` | « Cette liste change régulièrement » ; le lien Metabase de la spec (en `http://`) est mort, voir §13 |

Pas de paramètre `page`, `limit`, `page_size` ni `sort` : **aucune pagination**. ⚠️ Non vérifié : un paramètre `elligibleHandicapFilter` (boolean) existe dans le schéma interne LBA `zJobSearchApiV3Query` mais n'est pas documenté dans l'OpenAPI ; ne pas l'utiliser.

### 6.2 Réponse 200

Objet à trois champs, tous `required` (spec) :

| Champ | Type | Contenu |
|---|---|---|
| `jobs` | `JobOfferRead[]` | Offres publiées (§7). Au MVP, seule source de `offers` |
| `recruiters` | `JobRecruiter[]` | Entreprises sans offre publiée « susceptibles de recruter des apprentis dans le domaine », limitées à 150, impossible de tout récupérer. Ignorées au MVP (brief : offres publiées uniquement) mais le schéma Zod doit accepter le champ |
| `warnings` | `{ code: string, message: string }[]` | Avertissements non bloquants |

Codes de `warnings` (code, `job-opportunity-request-context.ts`) : `FRANCE_TRAVAIL_API_ERROR` (« Unable to retrieve job offers from France Travail API »), `JOB_OFFER_FORMATING_ERROR` (« Some job offers are invalid and have been excluded… »), `JOB_NOT_FOUND`, `RECRUITERS_FORMATING_ERROR`. Les codes sont stables, les messages ne le sont pas. Logger les warnings dans `sync-offers`.

### 6.3 Provenance, tri, plafond

Description FR de `jobs` (spec) : « Les offres proviennent de : collection sur la plateforme La bonne alternance ; France Travail ; publication via API par nos partenaires ; partenaire via flux spécifique. Actuellement, les résultats sont triés par : Priorité source (La bonne alternance > France Travail > autres partenaires) ; Augmentation de la distance (uniquement pour une recherche par emplacement) ; Date de création décroissante. Les résultats sont limités à 150 par source, et actuellement, il n'est pas possible de récupérer toutes les offres correspondant aux critères de recherche. » La version anglaise précise « 150 for each of the three sources i.e. 450 maximum results » ; la version française parle de quatre provenances sans donner le total.

Implémentation LBA (code, `findJobsOpportunities`) : quatre requêtes en parallèle (recruteurs LBA, offres LBA, offres partenaires, France Travail), `$limit: 150` chacune, concaténation `[offresLba, franceTravail, partenaires]`, chaque offre revalidée par Zod et **exclue** si invalide (warning `JOB_OFFER_FORMATING_ERROR`). Seules les offres de statut `Active` sont retournées (spec).

Pour couvrir une zone dense sans dépasser 150 par source : réduire le rayon, découper par code ROME ou par `departements`, ou utiliser `/job/v1/export` (§9).

### 6.4 Exemple

Requête (à exécuter avec une clé production pour obtenir des données réelles) :

```bash
curl -sS "https://api.apprentissage.beta.gouv.fr/api/job/v1/search?romes=M1805,M1806&latitude=48.8566&longitude=2.3522&radius=30&target_diploma_level=5" \
  -H "Authorization: Bearer $API_ALTERNANCE_KEY" \
  -H "Accept: application/json"
```

Réponse 200, **composée à partir des exemples de la spécification** (aucun appel authentifié n'a été fait ; tronquée) :

```json
{
  "jobs": [
    {
      "identifier": {
        "id": "6687165396d52b5e01b409545",
        "partner_job_id": "b16a546a-e61f-4028-b5a3-1a7bbfaa4e3d",
        "partner_label": "offres_emploi_lba"
      },
      "workplace": {
        "name": "DIRECTION INTERMINISTERIELLE DU NUMERIQUE (DINUM)",
        "description": "Service du Premier ministre…",
        "website": "https://beta.gouv.fr/startups/",
        "siret": "13002526500013",
        "location": {
          "address": "20 AVENUE DE SEGUR 75007 PARIS",
          "geopoint": { "type": "Point", "coordinates": [2.308628, 48.850699] }
        },
        "brand": null,
        "legal_name": "DIRECTION INTERMINISTERIELLE DU NUMERIQUE",
        "size": "100-199",
        "domain": {
          "idcc": 1979,
          "opco": "OPCO 2i",
          "naf": { "code": "8411Z", "label": "Administration publique générale" }
        }
      },
      "apply": {
        "phone": "0199000000",
        "url": "https://labonnealternance.apprentissage.beta.gouv.fr/recherche-apprentissage?display=list&page=fiche&type=matcha&itemId=664752a2ebe24062b758c641",
        "recipient_id": "partners_6687165396d52b5e01b409545"
      },
      "contract": {
        "start": "2024-09-23T10:00:00.000Z",
        "duration": 12,
        "type": ["Apprentissage"],
        "remote": "onsite"
      },
      "offer": {
        "title": "Développeur / Développeuse web",
        "desired_skills": ["Faire preuve d'autonomie", "Travailler en équipe"],
        "to_be_acquired_skills": ["Nouvelles technologies : Assembler des composants logiciels"],
        "access_conditions": ["Ce métier est accessible avec un diplôme de niveau Bac+2 (BTS, DUT) à Master…"],
        "opening_count": 1,
        "publication": { "creation": "2024-07-23T13:23:01.000Z", "expiration": "2027-05-14T00:00:00Z" },
        "rome_codes": ["M1805"],
        "description": "Conçoit, développe et met au point un projet d'application informatique…",
        "target_diploma": { "european": "5", "label": "BTS, DEUST (Bac+2)" },
        "status": "Active"
      },
      "is_delegated": false
    }
  ],
  "recruiters": [
    {
      "identifier": { "id": "6687165396d52b5e01b409546" },
      "workplace": { "...": "même structure que workplace ci-dessus" },
      "apply": {
        "phone": null,
        "url": "https://labonnealternance.apprentissage.beta.gouv.fr/…",
        "recipient_id": "recruiters_6687165396d52b5e01b409546"
      }
    }
  ],
  "warnings": []
}
```

Dans cet exemple, l'ordre des coordonnées `[longitude, latitude]` a été corrigé par rapport aux exemples de la spécification, qui sont inversés (voir §7.2).

## 7. Modèle `JobOfferRead` (spec, champ par champ)

Notation : « string \| null » signifie type `[string, null]` dans la spécification. Tous les objets et sous-champs sont `required` sauf mention contraire ; « required » n'empêche pas la valeur `null` quand le type l'admet. Le schéma Zod de `lib/providers/api-alternance.ts` doit déclarer nullable tout ce qui est nullable ici.

### 7.1 `identifier`

| Champ | Type | Description |
|---|---|---|
| `partner_job_id` | string | « Identifiant de l'offre dans le SI du partenaire » |
| `id` | string \| null | « Identifiant de l'offre dans la base La bonne alternance. » ObjectId Mongo (24 hexadécimaux, ex. `6687165396d52b5e01b409545`). C'est l'identifiant à passer à `GET /job/v1/offer/{id}`. La spécification ajoute : « Les offres France Travail ne sont pas stockées dans la base […] mais récupérées à la volée. Elles n'ont pas d'identifiant. » Cette phrase est **périmée** d'après le code courant (§7.7) ; coder `id` comme nullable dans tous les cas |
| `partner_label` | string | « Partenaire à l'origine de l'offre. Offres collectées par La bonne alternance : `offres_emploi_lba`. Entreprises à fort potentiel : `recruteurs_lba` ». Exemples : `France Travail`, `offres_emploi_lba`. Chaîne libre, ne pas coder en enum strict (§13) |

### 7.2 `workplace`

| Champ | Type | Description |
|---|---|---|
| `name` | string \| null | Enseigne, sinon raison sociale ; raison sociale de l'école si `is_delegated` |
| `description` | string \| null | |
| `website` | string (uri) \| null | |
| `siret` | string \| null, pattern `^\d{14}$` | SIRET du lieu d'exécution, ou de l'école si `is_delegated` |
| `location.address` | string | Adresse du lieu d'exécution |
| `location.geopoint` | `GeoJsonPoint` | `{ "type": "Point", "coordinates": [longitude, latitude] }`. Le schéma décrit le premier élément comme « Longitude » et le second comme « Latiude » (sic), mais **les valeurs d'exemple (48.850699, 2.308628) sont inversées**. Le code LBA construit le point avec `{ longitude, latitude }` explicites (ordre GeoJSON `[lng, lat]`). ⚠️ Non vérifié : ordre réel sur des données réelles, à contrôler au premier appel authentifié |
| `brand` | string \| null | Marque |
| `legal_name` | string \| null | Raison sociale |
| `size` | string \| null | Tranche d'effectif, ex. `100-199` |
| `domain.idcc` | number \| null | Convention collective |
| `domain.opco` | string \| null | |
| `domain.naf` | `{ code: string, label: string \| null }` \| null | Code NAF et libellé |

### 7.3 `apply`

| Champ | Type | Required | Description |
|---|---|---|---|
| `phone` | string \| null | oui | « Numéro de téléphone du recruteur ou du CFA si is_delegated = true ». Ce n'est pas un canal d'envoi, seulement une aide à la relance |
| `url` | string (uri) | oui | « URL de redirection vers le formulaire de candidature » ; non nul côté LBA (`apply_url: z.url()`) |
| `recipient_id` | string \| null | **non** (absent de `required`, donc potentiellement absent de l'objet) | « Identifiant à utiliser pour postuler à l'offre d'emploi via la route /v3/jobs/apply ou pour afficher le widget postuler. Si null, la candidature n'est pas disponible pour cette offre par la route apply_route ni par le widget /postuler. » Format `<collection>_<ObjectId>` avec collection `partners` ou `recruiters` (code, `applications.model.ts`) ; en pratique généré `partners_<_id>` pour toutes les opportunités stockées dans `jobs_partners`, y compris `recruteurs_lba`, dès qu'un `apply_email` est connu, sinon `null` (code, `job-opportunity.service.ts`). Modèle LBA : « généré à la volée pour les opportunités dont on dispose de l'adresse email » |

Décision d'implémentation : `apply.recipient_id != null` → `offers.apply_channel = api_alternance`, `apply_target = recipient_id` ; sinon `apply_channel = external_url`, `apply_target = apply.url`. Le canal `email` du brief n'est jamais alimenté par cette source (l'API n'expose pas l'adresse du recruteur).

### 7.4 `contract`

| Champ | Type | Description |
|---|---|---|
| `start` | string (date-time) \| null | Date de début |
| `duration` | integer \| null, minimum 0 | Durée en mois |
| `type` | array d'enum `Apprentissage`, `Professionnalisation` | Tableau (une offre peut porter les deux) |
| `remote` | enum `onsite`, `remote`, `hybrid` \| null | |

### 7.5 `offer`

| Champ | Type | Description |
|---|---|---|
| `title` | string, minLength 3 | |
| `desired_skills` | string[] | Compétences souhaitées |
| `to_be_acquired_skills` | string[] | Compétences à acquérir |
| `access_conditions` | string[] | Conditions d'accès |
| `opening_count` | number (pas `integer`) | Nombre de postes |
| `publication.creation` | string (date-time) \| null | Date de publication |
| `publication.expiration` | string (date-time) \| null | Date d'expiration. Pas de valeur par défaut garantie dans la réponse ; côté LBA, une offre déposée sans expiration reçoit `created_at + 2 mois` (début de journée, fuseau Europe/Paris), bien que la description du modèle interne dise « Si pas présente, mettre à creation_date + 60j » (code) |
| `rome_codes` | string[], pattern `^[A-Z]\d{4}$` | |
| `description` | string | |
| `target_diploma` | `{ european: "3".."7", label: string }` \| null | Niveau visé. Ne jamais parser `label` (les exemples de la spec sont d'anciens libellés), utiliser `european` (§12) |
| `status` | enum `Active`, `Filled`, `Cancelled` | « Seules les offres actives sont retournées par la recherche » |

### 7.6 `is_delegated`

Boolean, required, défaut `false` : « true si la gestion de l'offre est déléguée à un CFA partenaire ». Page explorer : si `true`, « l'offre provient d'un centre de formation » ; `workplace.name`, `workplace.siret`, `workplace.location.address` et `apply.phone` décrivent alors l'école, pas l'employeur. Conséquence pour `enrich-company` : ne pas enrichir la fiche employeur à partir du SIRET d'une offre déléguée sans le signaler.

### 7.7 Cas des offres France Travail

Deux chemins coexistent dans le code LBA :

- `convertFranceTravailJobToJobOfferApi` (conversion à la volée) produit `identifier.id = null`, `partner_job_id` = identifiant FT, `partner_label = "France Travail"`, `contract.start = null`, `offer.target_diploma = null`, `desired_skills` et `to_be_acquired_skills = []`, `publication.expiration = null`, `workplace.siret = null`, `apply.recipient_id = null`, `apply.url` = URL d'origine France Travail ; les offres FT sans latitude/longitude sont filtrées à la conversion (TODO dans le code).
- Mais `findJobsOpportunities` appelle désormais `findFranceTravailOpportunitiesFromDB`, qui lit les offres `partner_label = "France Travail"` stockées dans `jobs_partners` et passe par `convertToJobOfferApiReadV3` : ces offres **ont un `identifier.id`** (ObjectId) et auraient un `recipient_id` si un `apply_email` était renseigné. La phrase de la spécification « not stored… retrieved on the fly » est périmée.

Règles pour Candidatly : `identifier.id` et `apply.recipient_id` nullables dans tous les cas ; considérer en pratique que les offres France Travail ne sont pas candidatables par l'API (canal `external_url`). ⚠️ Non vérifié : part réelle des offres à `id` null et présence d'un `recipient_id` sur des offres France Travail, à mesurer sur données réelles.

### 7.8 `JobRecruiter` (tableau `recruiters`)

`identifier` ne contient que `id` (string, required ; pas de `partner_job_id` ni `partner_label`), `workplace` a la même structure que pour une offre, `apply` contient `phone`, `url` et `recipient_id` (format `recruiters_<ObjectId>` d'après l'enum `ZJobCollectionName`, ou `partners_<ObjectId>` dans le code de recherche courant). Pas de `contract`, `offer` ni `is_delegated`. Candidatables par l'API si un e-mail est connu (candidature spontanée, hors périmètre MVP).

### 7.9 Stabilité des identifiants

- `identifier.id` est le `_id` Mongo de la collection `jobs_partners`. Lors d'un upsert, LBA conserve le `_id` existant quand le couple (`partner_label`, `partner_job_id`) est retrouvé (`_id = current?._id ?? new ObjectId()`, code) : `id` est stable tant que l'offre existe. Le couple (`partner_label`, `partner_job_id`) est déclaré invariant côté LBA (`InvariantFields`).
- Clé d'unicité retenue pour `offers.external_id` (convention `CLAUDE.md`) : `partner_label + ":" + partner_job_id`, avec `identifier.id` conservé dans `raw` et utilisé pour le rechargement par `GET /job/v1/offer/{id}`.

## 8. Détail : `GET /job/v1/offer/{id}`

- Description (spec) : « Accéder au détail d'une offre à partir de son identifiant. Limite : 120 appels par minute, par consommateur. L'endpoint publishing-informations partage la même limite. »
- Paramètre de chemin `id` (string, required) : « Identifiant unique de l'offre » = `identifier.id`. Côté LBA `params: { id: zObjectId }` puis `findOne({ _id })` dans `jobs_partners` (code) : un `id` qui n'est pas un ObjectId donne un 400, un `id` inconnu un 404 « Aucune offre d'emploi trouvée pour l'ID: … » avec warning `JOB_NOT_FOUND`.
- Réponse 200 : un objet `JobOfferRead` (même schéma que dans `jobs[]`). Autres codes : 400, 401, 403, 404, 409, 419 (lire 429), 500, 502, 503.
- Les offres à `identifier.id = null` ne peuvent pas être rechargées par cette route.
- Usage recommandé : rafraîchir l'offre (statut, expiration, `recipient_id`) juste avant `send-application`.
- `GET /job/v1/offer/{id}/publishing-informations` : état de la dernière publication d'une offre déposée (`publishing.status` parmi `WILL_BE_PUBLISHED`, `PUBLISHED`, `WILL_NOT_BE_PUBLISHED` ; `error { code, label }` avec codes `CLOSED_COMPANY`, `DUPLICATE`, `STAGE`, `EXPIRED`, `CFA`, `ROME_BLACKLISTED`, `WRONG_DATA`, `NON_DIFFUSIBLE`). Utile seulement aux déposants d'offres.

```bash
curl -sS "https://api.apprentissage.beta.gouv.fr/api/job/v1/offer/6687165396d52b5e01b409545" \
  -H "Authorization: Bearer $API_ALTERNANCE_KEY"
```

## 9. Export : `GET /job/v1/export`

- Description (spec) : « Liste toutes les opportunités (offres et entreprises pour candidature spontanée). Mises à jour une fois par jour à 3:00 heure de Paris. Limite : 2 appels par minute. » « La structure des offres est identique à la réponse de la route de recherche. »
- Réponse 200 : `{ "url": string, "lastUpdate": string (date-time) }`. `url` est une URL S3 signée **valide 2 minutes** (`s3SignedUrl(..., { expiresIn: 120 })`, code) : télécharger immédiatement.
- Intérêt pour `sync-offers` : un téléchargement quotidien puis filtrage local (ROME, distance, niveau) évite le plafond de 150 offres par source et le découpage par couple (ROME, zone). Contrepartie : fraîcheur d'un jour au lieu du temps réel, alors que le brief impose un cache de 6 h par couple ROME + zone. Décision à prendre en phase 2 (voir `docs/QUESTIONS.md`) ; une stratégie mixte (export quotidien comme base, recherche temps réel en complément pour les couples actifs) est compatible avec les quotas.
- ⚠️ Non vérifié : format exact du fichier exporté (JSON, découpage, compression) ; seule la structure des offres est documentée.

## 10. Candidature : `POST /job/v1/apply`

### 10.1 Identité, habilitation, restriction d'usage

- `POST https://api.apprentissage.beta.gouv.fr/api/job/v1/apply`, `operationId: jobApply`, corps `application/json` (`JobApplicationWrite`, `required: true`), réponse `202`.
- Description (spec) : « Habilitation requise : `applications:write`. Accordée automatiquement avec une clé sandbox. Pour une clé production, la demander par e-mail à support_api@apprentissage.beta.gouv.fr. […] La candidature est ensuite envoyée au recruteur par email. Limite : 10 appels par minute, par consommateur. »
- Restriction (page explorer, texte exact) : « Cette API est réservée aux services traitant un volume important de candidatures. Les demandes d'habilitation pour un usage individuel ne seront pas accordées. » Un SaaS multi-étudiants entre dans la catégorie « service », mais l'habilitation production reste à la discrétion du support (§15).
- Proxy (code) : `bodyLimit` 5 Mo, transmission du corps tel quel à LBA `POST /v2/application`, timeout 10 s, pas de rejeu pour POST, statut et corps de LBA renvoyés tels quels au client.

### 10.2 Corps de requête `JobApplicationWrite` (`additionalProperties: false`)

| Champ | Type (spec) | Obligatoire | Contraintes documentées | Compléments (code LBA) |
|---|---|---|---|---|
| `applicant_first_name` | string | oui | minLength 1, maxLength 50 | Les URL sont retirées du texte (`withoutUrls`) |
| `applicant_last_name` | string | oui | minLength 1, maxLength 50 | idem |
| `applicant_email` | string, format email | oui | | E-mails jetables refusés (400 « Disposable email are not allowed »). Sert d'identifiant du candidat (`getOrCreateApplicant`) pour les quotas |
| `applicant_phone` | string | oui | Page explorer : « Seuls les numéros de téléphone européens sont autorisés. Il y a également une vérification sur la nature du numéro : seuls les téléphones mobiles et fixes sont autorisés. » | Le validateur réel (`validatePhone`, `libphonenumber-js/max`) n'est pas limité à l'Europe : il convertit `0X…` en `+33`, exige `isPossible()` pour tout pays et n'interdit que les types PREMIUM_RATE, PAGER, VOICEMAIL, SHARED_COST. Message d'erreur : « Invalid Phone Number: please use international format (+XXXX...) or french national format (06XXX...) ». Normaliser en E.164 (`+33…`) avant envoi |
| `applicant_attachment_name` | string | oui | minLength 1, pattern `((.*?))(\.)+([Dd][Oo][Cc][Xx]\|[Pp][Dd][Ff])$` (extension `.pdf` ou `.docx`, insensible à la casse) | L'extension doit correspondre au type réel détecté |
| `applicant_attachment_content` | string, format byte | oui | maxLength 4 215 276 caractères. Page explorer : « Le CV doit être encodé en base64, et seuls les formats PDF et DOCX sont autorisés. La taille du fichier ne doit pas dépasser 3 Mo. Le content-type du fichier et la mention de l'encodage en Base64 doivent préfixer le contenu encodé. Ex : data:application/pdf;base64,<contenu_encodé_base64> » | Préfixes acceptés exactement : `data:application/pdf;base64,` ou `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,`. Type sniffé (`fileTypeFromBuffer`) et comparé à l'extension, sinon 400 « File type is not supported » |
| `applicant_message` | string \| null | non | « Message du candidat ». Aucune longueur maximale documentée | `applicant_message_to_company: z.string().nullable()` sans maximum ; texte assaini (`sanitizeTextField`) avant insertion dans l'e-mail. **C'est le seul canal pour la lettre de motivation** |
| `recipient_id` | string | oui | « Identifiant du destinataire récupéré de `apply.recipient_id` depuis les resultas de la route de recherche. » (sic) | Format `<collection>_<ObjectId>`, collection `partners` ou `recruiters` ; ObjectId invalide → erreur de validation |

Aucun champ de consentement. Le corps public LBA (`ZApplicationApiPublic`) accepte aussi `applicant_contract_duration`, `applicant_contract_start`, `applicant_formation_description` (200 max), `applicant_inscription_formation`, `applicant_rythm_description` (200 max), `applicant_answers_to_recruiter_questions`, `foreign_application_id`, `foreign_application_status_url`, mais le proxy les rejette (`additionalProperties: false`) : inutilisables via l'API Alternance.

### 10.3 Réponse

`202` « Succès » : `{ "id": string }` (« Identifiant de la candidature. »). Côté LBA : `res.status(202).send({ id: result._id.toString() })` après insertion en base et écriture du CV sur S3 ; l'envoi effectif est différé (§11.1). `id` est un ObjectId Mongo de la collection `applications` : à stocker dans `applications.external_application_id`.

### 10.4 Erreurs spécifiques à `apply`

| Code | Message (`message`) | Cause |
|---|---|---|
| 400 | « Request validation failed » | Validation Zod du proxy (détail dans `data`) |
| 400 | « File type is not supported » | Préfixe base64 absent ou type réel différent de l'extension (code) |
| 400 | « Disposable email are not allowed » | E-mail jetable (code) |
| 400 | « Job or recruiter not found » | `recipient_id` inconnu ; renvoyé en 400 alors que la spec documente 404 (code) |
| 400 | « Job offer has expired » | `offer_status != Active` ou `offer_expiration + 1 jour` dépassé (tolérance d'un jour) (code) |
| 400 | « Internal error: no contact email found for the corresponding ressource » | Aucun `apply_email` sur l'opportunité (sauf partenaire Taleez, §11.2) (code) |
| 400 | « UNKNOWN » | Erreur interne à l'insertion (code) |
| 401 | voir §3 | |
| 403 | « Vous n'êtes pas autorisé à accéder à cette ressource » | Organisation absente ou sans `applications:write` (clé production) |
| 429 | « Quota dépassé : 10 requêtes par 1 minute… » | Rate limit du proxy (corps avec clé `error`) |
| 429 | « Maximum application per offer reached », « Maximum application per recruiter reached », « Maximum application per day reached » | Quotas métier LBA (§11.2). ⚠️ Non vérifié : corps exact (format Boom inféré) |
| 504 | | Timeout de 10 s du proxy vers LBA ; la candidature a pu être enregistrée (code) |

### 10.5 Exemple

Corps repris de la fixture de test du proxy (`job.route.test.ts`), `recipient_id` remplacé par le format réel :

```bash
curl -sS -X POST "https://api.apprentissage.beta.gouv.fr/api/job/v1/apply" \
  -H "Authorization: Bearer $API_ALTERNANCE_KEY" \
  -H "Content-Type: application/json" \
  --data @- <<'EOF'
{
  "applicant_first_name": "Jean",
  "applicant_last_name": "Dupont",
  "applicant_email": "jeam.dupont@mail.com",
  "applicant_phone": "0101010101",
  "applicant_attachment_name": "cv.pdf",
  "applicant_attachment_content": "data:application/pdf;base64,JVBERi0xLjQK...",
  "applicant_message": "Madame, Monsieur, ...",
  "recipient_id": "partners_6687165396d52b5e01b409545"
}
EOF
```

Réponse attendue :

```http
HTTP/1.1 202 Accepted
Content-Type: application/json; charset=utf-8

{"id":"66a1f0c2e4b0a1b2c3d4e5f6"}
```

Réponse observée sans clé (9 septembre 2026) : `401 {"statusCode":401,"name":"Unauthorized","message":"Vous devez fournir une clé d'API valide pour accéder à cette ressource"}`.

### 10.6 Idempotence et doublons

Aucune clé d'idempotence, aucun en-tête dédié, aucune détection de doublon exact : chaque appel accepté crée un document `applications` (jusqu'à la limite de 3 par candidat et par offre). Règles pour `send-application` :

- débiter le crédit et écrire `external_application_id` dans la même transaction que le passage en `sent` ;
- ne jamais rejouer après un 202, un 504, un timeout client ou une erreur réseau ; remonter l'incertitude à l'utilisateur (« envoi non confirmé ») plutôt que de renvoyer ;
- rafraîchir l'offre par `GET /job/v1/offer/{id}` avant l'envoi pour éviter le 400 « Job offer has expired ».

## 11. Ce qui se passe après le 202 (La bonne alternance, code)

### 11.1 Traitement asynchrone

`POST /v2/application` : validation du type de fichier, rejet des e-mails jetables, création ou récupération du candidat par e-mail, contrôle de l'offre (existe, `Active`, non expirée avec tolérance d'un jour), quotas, contrôle du seuil de 80, exigence d'un `apply_email` (sauf Taleez), écriture du CV sur S3, insertion en base avec `scan_status: WAITING_FOR_SCAN`, réponse 202. Puis cron « Scan et envoi des candidatures » (`*/10 * * * *`) : scan antivirus ClamAV, `sendRecruteurEmail`, `sendCandidatEmail`, suppression du CV sur S3 (`deleteApplicationCvFile`). Délai typique inférieur à 10 minutes, sans garantie. Si un virus est détecté : statut `VIRUS_DETECTED`, e-mail « Echec d'envoi de votre candidature » au candidat, rien au recruteur.

### 11.2 Règles anti-spam et quotas métier (`application.service.ts`)

| Constante | Valeur | Effet |
|---|---|---|
| `MAX_MESSAGES_PAR_OFFRE_PAR_CANDIDAT` | 3 | 429 « Maximum application per offer reached » si le candidat (même e-mail) a déjà 3 candidatures sur cette offre (ou, pour un recruteur LBA, sur ce SIRET). Aucun délai minimal entre deux envois |
| `MAX_MESSAGES_PAR_SIRET_PAR_CALLER` | 20 | 429 « Maximum application per recruiter reached » si le `caller` (nom de l'organisation portée par la clé API, transmis dans le JWT du proxy) a déjà envoyé 20 candidatures aujourd'hui vers ce SIRET. **Limite la plus contraignante pour un SaaS multi-utilisateurs : 20 étudiants par jour et par entreprise, toutes offres confondues.** Codée en dur, donc négociable seulement par changement de code côté LBA |
| `MAX_CANDIDATURES_PAR_CANDIDAT_PAR_JOUR` | 100 | 429 « Maximum application per day reached » si le candidat a plus de 100 candidatures dans la journée calendaire |
| `MAX_APPLICATIONS_PER_OFFER` | 80 | Ne rejette pas la candidature courante : si `count + 1 > 80`, l'offre (LBA ou partenaire, pas les recruteurs) passe en `Cancelled` avec la raison « nombre maximum de candidatures atteint (80) » et la candidature en cours est quand même enregistrée ; les suivantes échouent en « Job offer has expired ». Un cron toutes les 30 minutes clôture aussi les `offres_emploi_lba` actives au seuil et prévient le recruteur (« Votre offre d'alternance a été dépubliée ») |

Cas particulier : pour les partenaires de `PARTNERS_WITH_APPLICATION_API` (`["Taleez"]`), la candidature est poussée vers l'API Taleez au lieu d'un e-mail et l'absence d'`apply_email` ne bloque pas.

### 11.3 E-mails envoyés

- Expéditeur : `"La bonne alternance" <nepasrepondre@apprentissage.beta.gouv.fr>`, sans `replyTo` (une réponse directe au mail part vers l'adresse no-reply, pas vers l'étudiant). Envoi SMTP via Brevo.
- **Au recruteur** (`application.company_email` = `apply_email` de l'offre, ou e-mail du CFA mandataire si `is_delegated`). Sujet : « Candidature en alternance - <titre de l'offre>  - <Prénom> <Nom> » (double espace avant le second tiret) ; candidature spontanée : « Candidature spontanée en alternance <entreprise> ». Corps (template `mail-candidature.mjml.ejs`) : « Vous avez reçu une candidature ! », deux boutons « Répondre au candidat » et « Refuser la candidature » (liens tokenisés vers le formulaire d'intention LBA), « Son message personnalisé » (`applicant_message`, ou « Aucun message renseigné »), coordonnées du candidat (téléphone, e-mail en `mailto:`), CV en pièce jointe sous son nom d'origine, mentions DGEFP et droit d'opposition.
- **Au candidat** : sujet « Votre candidature chez <entreprise> » (template `mail-candidat-offre-emploi`) : confirmation d'envoi, rappel du message et de la pièce jointe, conseil de relance téléphonique à J+10 (`created_at + 10 jours`) au numéro du recruteur avec un script de relance, « Ce courriel est généré automatiquement, vous ne pouvez pas y répondre. » ⚠️ Non vérifié : une mention « par 1jeune1solution / par OpenClassrooms / via Hellowork » n'est ajoutée que pour les callers connus de LBA ; aucune mention de Candidatly n'apparaîtrait dans les e-mails.
- **Réponse du recruteur** : via le formulaire LBA, qui envoie au candidat soit « Objet : Suite donnée à votre candidature - <entreprise> » (intention `entretien`, recruteur en copie, texte par défaut proposant un retour sous 30 jours), soit « Réponse négative de <entreprise> à la candidature de <Prénom> <Nom> » (intention `refus`). Motifs de refus exacts (enum `RefusalReasons`) : « Compétences insuffisantes ou non adaptées », « Manque de personnalisation de la candidature », « Avis négatif sur l'école/la formation », « Type de contrat inadapté », « Notre entreprise ne recrute pas sur le métier recherché ». Le nom du partenaire n'apparaît dans ces sujets que si le caller est dans `PARTNER_NAMES`.
- **Hardbounce** de l'e-mail recruteur : le candidat reçoit « Votre candidature n'a pas pu être envoyée à <entreprise> » ; le consommateur API n'est pas prévenu.

### 11.4 Absence de callback

Aucune route de l'OpenAPI ne permet de lire une candidature, son statut, sa consultation ou la réponse du recruteur ; aucun webhook. Les seuls retours asynchrones du code sont internes (statuts renvoyés à l'ATS Hellowork). Conséquence explicite pour le brief : les statuts `viewed`, `replied_positive`, `replied_negative` ne peuvent être alimentés que par l'étudiant (saisie manuelle) ou, en V2, par lecture de sa boîte mail ; `no_answer` à J+14 et `next_follow_up_at` restent calculables localement.

### 11.5 Alternative sans habilitation : le widget `/postuler`

Fiche data.gouv.fr : widget utilisable « Seulement dans le cas où l'offre dispose d'une adresse email dans le champ apply_email » ; iframe `https://labonnealternance.apprentissage.beta.gouv.fr/postuler?caller={caller}&itemId={itemId}&type={type}` ; le code accepte aussi `recipient_id=` (découpé en `type_itemId`) et exige `caller` (code, `PostulerPage.tsx`). L'étudiant remplit alors le formulaire LBA lui-même : pas de crédit débité côté API, pas d'`external_application_id` récupérable. Guide : `api.gouv.fr/guides/widget-la-bonne-alternance`.

## 12. Niveaux de diplôme

- Enum `target_diploma_level` (recherche) et `offer.target_diploma.european` : `"3"`, `"4"`, `"5"`, `"6"`, `"7"` (cadre européen des certifications). Pour `/formation/v1/search`, l'enum va de `"1"` à `"8"`.
- Libellés officiels actuels (`NIVEAU_DIPLOME_LABEL`, code LBA, migration du 26 juin 2026 qui a remplacé les anciens libellés dans `jobs_partners`) :

| `european` | Libellé actuel | Ancien libellé (encore visible dans les exemples de la spec) |
|---|---|---|
| `3` | CAP, BEP (Infrabac) | Cap, autres formations (Infrabac) |
| `4` | Bac, Bac Pro, BP (Bac) | BP, Bac, autres formations (Bac) |
| `5` | BTS, DEUST (Bac+2) | BTS, DEUST, autres formations (Bac+2) |
| `6` | Licence, BUT, Licence Pro (Bac+3) | Licence, Maîtrise, autres formations (Bac+3 à Bac+4) |
| `7` | Master, titre ingénieur, grande école (Bac+5) | Master, titre ingénieur, autres formations (Bac+5) |

- Sémantique du filtre (doc FR du paramètre) : « nous retournons les données où le niveau de diplôme cible est inconnu / non précisé / indifférent et lorsque le niveau correspond au niveau demandé. En filtrant sur le « 4 », seules les données relatives à ce niveau, ainsi que celles avec des niveaux inconnus ou non précisés, vous seront renvoyées. » Le filtre est **inclusif** : les offres sans `target_diploma` remontent toujours ; `compute-matches` doit gérer `target_diploma = null`.
- Nuance (commentaire de `recruteur.ts`, code) : le moteur LBA filtre sur le niveau **visé** en fin d'études, pas sur le niveau requis à l'entrée ; pour l'API offres France Travail en revanche, le filtre est le niveau requis en entrée (mapping `NIVEAUX_POUR_OFFRES_PE` : 3 → NV5 … 7 → NV1).
- Proposition de mapping `profiles.diploma_level` (brief : `bac`, `bac+2`, `bac+3`, `bac+4`, `bac+5`) vers `target_diploma_level`, à valider par l'owner :

| `profiles.diploma_level` | `target_diploma_level` | Justification |
|---|---|---|
| `bac` | `4` | |
| `bac+2` | `5` | |
| `bac+3` | `6` | |
| `bac+4` | `6` | Aucun niveau européen intermédiaire ; l'ancien libellé du niveau 6 couvrait « Bac+3 à Bac+4 » |
| `bac+5` | `7` | |

Question ouverte : `diploma_level` du profil désigne-t-il le niveau **actuel** ou le niveau **visé** par l'alternance ? Le filtre API attend le niveau visé (voir `docs/QUESTIONS.md`).

## 13. Partenaires et `partner_label`

- Valeurs connues de l'enum `JOBPARTNERS_LABEL` (code LBA, `jobs-partners.model.ts`) : `offres_emploi_lba`, `recruteurs_lba`, `Hellowork`, `ATS_Hellowork`, `France Travail`, `FranceTravail CEGID`, `RH Alternance`, `PASS`, `Monster`, `Meteojob`, `Kelio`, `La Poste`, `Le bon coin emploi`, `annonces Atlas`, `Nos Talents Nos Emplois`, `Vite un emploi`, `Toulouse metropole`, `Jooble`, `Décathlon`, `Engagement Jeunes`, `Jobteaser`, `APEC`, `EDF`, `Les emplois de l'inclusion`, `Enedis`, `L'Etudiant`. Commentaire du code : les labels des partenaires qui déposent par API ne sont volontairement pas listés (« nous ne connaissons pas leurs valeurs »). **Ne pas coder `partner_label` en enum strict.**
- Page explorer : « offres_emploi_lba : 25 000 offres en 2025 ; offres_emploi_partenaires : France Travail, Météojobs, flux Enedis/Engie, multidiffuseurs Talentplug, Veritone, ATS Kelio, Wink : 325 000 offres diffusées en 2025 ; recruteurs_lba : 400 000 entreprises en 2025 ».
- Page Notion « Liste des partenaires de La bonne alternance » (liée depuis la page explorer du dépôt d'offres, rendue en JS) : La bonne alternance, France travail, Hellowork, Meteojob, Le bon coin emploi, Jobteaser, L'Étudiant, APEC, RH Alternance, Jobs that make sense, OPCO EP, 1jeune1solution, Bretagne Alternance, Vite un emploi (CCI Paris), Nos Talents Nos Emplois, PASS, Bloom Alternance, Toulouse Métropole, Emploi Territorial, APECITA, sites carrières (EDF, La Poste, L'Oréal, BPCE, Institut Pasteur, Engie), ATS (CEGID Digitalrecruiters, Kelio, Wink, Taleez, Buddi), multidiffuseurs (TalentPlug, Veritone, JobPosting, iQuesta, VonQ).
- Écarts avec le brief (« France Travail, Monster, Indeed, 1jeune1solution… ») : Monster est dans l'enum du code mais pas sur la page Notion ; **Indeed n'apparaît dans aucune source** ; 1jeune1solution figure sur la page Notion mais pas dans l'enum. ⚠️ Non vérifié : 1jeune1solution serait un consommateur (`caller`) de l'API plutôt qu'une source d'offres.
- La liste Metabase référencée par `partners_to_exclude` (`labonnealternance.apprentissage.beta.gouv.fr/metabase/public/question/70f84c13-6156-4933-9fb3-54c88887d95d`) est morte : « Introuvable » dans un navigateur, 404 sur l'API publique Metabase, lien en `http://` dans la spécification. La page Notion et l'enum du code servent de référence provisoire ; la liste des partenaires réellement candidatables (avec `recipient_id`) ne pourra être établie qu'empiriquement sur les résultats de `/job/v1/search`.

## 14. Routes annexes utiles au projet

- **Aucune route de recherche de codes ROME par texte** dans la spécification (aucune occurrence de « appellation » ni « metier »). Le mapping texte libre → ROME du brief repose donc sur le LLM et la nomenclature officielle (`docs/ROME.md`).
- `GET /certification/v1` (clé requise, pas de rate limit serveur) : filtres `identifiant.cfd` (pattern `^([A-Z0-9]{3}\d{3}[A-Z0-9]{2}|null)?$`) et `identifiant.rncp` (`^(RNCP\d{3,5}|null)?$`) ; sans filtre, retourne toutes les certifications. Réponse : tableau `Certification` avec `identifiant { cfd, rncp, rncp_anterieur_2019 }`, `intitule { cfd { long, court }, niveau { cfd { europeen "1".."8" | null, sigle, libelle }, rncp { europeen } }, rncp }`, `domaines.rome.rncp: [{ code (^[A-Z]{1}\d{0,4}$), intitule }] | null`, `periode_validite.rncp.actif`. Permet RNCP → codes ROME et niveau européen (utile si l'étudiant connaît le RNCP de sa formation), pas texte → ROME.
- `GET /formation/v1/search` : `romes`, `rncp`, `latitude`, `longitude`, `radius`, `target_diploma_level` (1..8), `include_archived`, pagination `page_size` (défaut 100, max 1000) et `page_index` (défaut 0). Formations, pas offres ; hors périmètre.
- ⚠️ Non vérifié : `GET /geographie/v1/commune/search?code=<INSEE ou code postal>` (paramètre requis, pattern `^\d{5}$`) renvoie des communes ; non testé, hors périmètre puisque le géocodage passe par la Géoplateforme (`docs/API_ADRESSE.md`).
- Routes **non documentées** du site La bonne alternance, publiques (`securityScheme: null` dans `shared/src/routes/rome.routes.ts`), vérifiées sans clé (observé) :
  - `GET https://labonnealternance.apprentissage.beta.gouv.fr/api/rome?title=<texte>[&withRomeLabels=true]` → `{ labelsAndRomes: [{ label, romes: string[], rncps: string[], type: "job", romeTitles?: [{ codeRome, intitule }] }], labelsAndRomesForDiplomas: [{ label, romes, rncps, type: "diploma" }] }` (ex. « developpeur » → « Développement web, intégration » : M1805, M1855, M1825…) ; `labelsAndRomesForDiplomas` n'a pas de `romeTitles`.
  - `GET /api/rome/detail/<code>` → fiche ROME avec `rome { code_rome, intitule, code_ogr }`, `appellations [{ libelle, libelle_court, code_ogr }]`, `numero`, `definition`, `acces_metier`, `competences`, `contextes_travail`, `mobilites`.
  - Ces routes servent le site LBA, ne sont couvertes ni par la documentation ni par les CGU de l'API et peuvent changer sans préavis : à utiliser au mieux comme aide au développement (validation du mapping ROME du LLM), jamais en production.

## 15. Conditions d'utilisation, licence, attribution, données personnelles

### 15.1 Restrictions d'usage (point bloquant)

Textes exacts servis par le portail le 9 septembre 2026 :

- `/fr/explorer/recherche-offre` : « **L'utilisation de cette API est gratuite et réservée à des usages non lucratifs. Notez que toute utilisation de ces données à des fins commerciales, telles que la revente ou la facturation de l'accès pour des tiers comme des candidats est interdite.** »
- `/fr/explorer/recuperation-detail-offre` : même phrase, élargie à « des tiers comme des candidats, entreprises ou écoles ».
- `/fr/explorer/candidature-offre` : « Cette API est réservée aux services traitant un volume important de candidatures. Les demandes d'habilitation pour un usage individuel ne seront pas accordées. »
- CGU de l'Espace développeurs (`https://api.apprentissage.beta.gouv.fr/cgu`, « Dernière mise à jour le : 31 mars 2025 - v1.0 », éditeur DGEFP) : art. 1 « L'inscription est gratuite et ouverte à tous. » ; art. 2 : destiné « notamment aux opérateurs publics et privés, aux organismes de formation, aux entreprises, chefs de projets, développeurs ou apprenants » ; art. 5.1 : l'éditeur « se réserve notamment le droit de suspendre ou de bloquer l'accès à un compte d'un Utilisateur ne respectant pas les présentes conditions générales d'utilisation » et peut « faire évoluer, modifier ou suspendre, sans préavis, la Plateforme » ; art. 5.2 : « L'Utilisateur s'assure de garder son jeton d'accès à l'API secret. Toute divulgation du jeton quelle que soit sa forme, est interdite. » « Il s'engage à ne pas commercialiser les données reçues et à ne pas les communiquer à des tiers en dehors des cas prévus par la loi. » « Toute information transmise par l'Utilisateur est de sa seule responsabilité. », rappel de l'article 441-1 du code pénal (fausse déclaration) ; art. 6 : les CGU peuvent être amendées à tout moment. Les CGU ne parlent ni d'attribution, ni de durée de cache, ni de quotas, ni de statut partenaire.
- CGU de La bonne alternance (`/conditions-generales-utilisation`, « Dernière mise à jour le : 03/11/2023 ») : « Toute utilisation non autorisée des contenus ou informations de la Plateforme, notamment à des fins d'exploitation commerciale, pourra faire l'objet de poursuites sur la base d'une action en contrefaçon et/ou d'une action en concurrence déloyale et/ou parasitisme » ; obligation de « ne communiquer que des informations, fichiers et autres contenus conformes à la réalité, honnêtes et loyaux », sous peine de suspension ou suppression du compte. Droit français, Tribunal administratif de Paris.

Conséquence pour Candidatly : le modèle « 1 crédit = 1 envoi » facture à l'étudiant l'accès à la route de candidature et aux données d'offres, ce que ces pages interdisent explicitement. Trois issues possibles, à trancher avant la phase 2 : accord écrit de `support_api@apprentissage.beta.gouv.fr` ; facturation limitée aux services propres (génération de lettre, fiche entreprise) avec envoi API gratuit ; canal d'envoi alternatif (redirection `apply.url`, e-mail direct). Un accord obtenu ne dispense pas du respect de la limite de 20 candidatures par jour et par SIRET.

### 15.2 Licence des données et attribution

- `info.license = Etalab-2.0` (spec), pied de page des CGU LBA (« Sauf mention contraire, tous les contenus de ce site sont sous licence etalab-2.0 »), « Open Licence 2.0 » sur data.gouv.fr. La Licence Ouverte 2.0 accorde « un droit non exclusif et gratuit de libre Réutilisation […] à des fins commerciales ou non » et impose de « mentionner la paternité de l'Information : sa source (a minima le nom du Concédant) et la date de la dernière mise à jour de l'Information réutilisée », par exemple « en indiquant l'adresse (URL) renvoyant vers l'Information ».
- Il y a donc une tension entre la licence des données (réutilisation commerciale autorisée avec attribution) et les conditions particulières du portail (usage non lucratif, non-commercialisation). Les conditions particulières s'appliquent au **service d'API** ; la route `apply` est un service d'écriture, pas une donnée. La licence ouverte n'annule pas les CGU.
- Attribution pratique pour Candidatly : afficher « Source : La bonne alternance » avec un lien vers l'offre (`apply.url`) et la date de dernière mise à jour (date de synchronisation) sur chaque fiche offre. Aucune exigence d'attribution supplémentaire n'est documentée.

### 15.3 Données personnelles

- Politique de confidentialité LBA (dernière mise à jour 05/02/26) : données des candidats « conservées pendant une durée de 24 mois à compter de leur collecte » ; CV « supprimés immédiatement après la transmission de la candidature au recruteur » ; destinataires : DGEFP et sous-traitants, organismes de formation, réseaux consulaires, entreprises ; DPO : `contact@labonnealternance.apprentissage.beta.gouv.fr`. Code : cron quotidien `15 0 * * *` qui anonymise et supprime les candidatures de plus de deux ans ; CV effacé de S3 après traitement.
- Politique de confidentialité du portail : données de compte (nom, prénom, e-mail) conservées « 2 ans à compter de la dernière utilisation du compte » ; sous-traitants OVH (hébergement) et Brevo (e-mails) ; contact `api@apprentissage.beta.gouv.fr` ; DPD 127 rue de Grenelle, 75007 Paris.
- Mentions légales du portail : éditeur DGEFP (14 avenue Duquesne, 75007 Paris), directeur de publication Benjamin MAURICE, hébergeur OVH SAS ; deux dates de mise à jour incohérentes (« 23 mars 2024 » en en-tête, « 27/03/2024 » dans le corps).
- Conséquence pour Candidatly : l'écran de confirmation d'envoi et la politique de confidentialité doivent informer l'étudiant que ses nom, prénom, e-mail, téléphone, message et CV sont transmis à la DGEFP / La bonne alternance puis au recruteur, et conservés 24 mois par La bonne alternance.

## 16. Cache et rétention

- Aucune durée maximale de conservation ou de cache des offres n'est documentée (ni spec, ni CGU). Indications indirectes : `offer.publication.expiration` par offre, export « mis à jour une fois par jour à 3:00 heure de Paris », règle « seules les offres actives sont retournées », clôture automatique à 80 candidatures, tolérance d'un jour après expiration côté `apply`.
- Le TTL de 6 h du brief n'est contredit par aucune règle publiée. Recommandations : supprimer logiquement les offres absentes de la dernière synchronisation ou dont `expires_at` est passé ; ne jamais envoyer une candidature sans rafraîchir l'offre par `GET /job/v1/offer/{id}` ; conserver `raw` pour rejouer le mapping sans rappeler l'API.

## 17. Pièges

1. **Clé sandbox = données de recette**, y compris pour la recherche. Ne pas construire `sync-offers` avec une clé sandbox.
2. **Exemples de coordonnées inversés** dans la spécification (paramètres de recherche et `GeoJsonPoint`). Envoyer `latitude=48.8566&longitude=2.3522` pour Paris ; lire `coordinates[0]` comme longitude et `coordinates[1]` comme latitude, et vérifier sur données réelles.
3. **419 dans la spec, 429 en réalité** ; corps du 429 du proxy avec clé `error` au lieu de `name`. Traiter 419 et 429 de la même façon, accepter `name` ou `error`.
4. **Pas de pagination, 150 offres maximum par source.** Découper les recherches ou utiliser l'export.
5. **`recipient_id` peut être absent** de l'objet (non listé dans `required`) ou `null` : schéma Zod `z.string().nullable().optional()`.
6. **`identifier.id` nullable** malgré la lecture des offres France Travail depuis la base ; clé d'unicité `partner_label:partner_job_id`.
7. **`is_delegated = true`** : `workplace` et `apply.phone` décrivent l'école, pas l'employeur.
8. **`target_diploma.label`** change (migration de juin 2026) : ne parser que `european`.
9. **Filtre de niveau inclusif** : les offres sans niveau remontent toujours.
10. **CV** : préfixe `data:application/pdf;base64,` (ou DOCX) obligatoire, type réel vérifié, extension cohérente, 3 Mo maximum, `maxLength` 4 215 276 caractères. Un CV converti en PDF côté serveur évite les surprises du DOCX.
11. **Téléphone obligatoire** pour `apply` : le champ `profiles.phone` du brief devient obligatoire avant tout envoi ; normaliser en `+33…`.
12. **Pas d'idempotence** sur `apply`, pas de callback : ne jamais rejouer, stocker l'`id`, suivi manuel.
13. **Quota 20 candidatures par jour et par SIRET pour toute l'organisation** : prévoir un compteur local par SIRET et par jour pour anticiper le 429 et l'expliquer à l'utilisateur.
14. **E-mails sans `replyTo`** : le recruteur qui répond directement au mail n'atteint pas l'étudiant ; la relance du brief passe par le téléphone (`apply.phone`) ou le formulaire LBA.
15. **Jeton de 365 jours non prolongeable**, e-mails d'alerte à J-30 et J-15 sur l'adresse du compte : mettre l'échéance dans `docs/RUNBOOK.md`.
16. **`partner_label` libre**, liste Metabase morte : ne pas dépendre d'une liste fermée.
17. **`contract.type` est un tableau** alors que `offers.contract_type` du brief est scalaire : décider de l'aplatissement (§18).

## 18. Mapping vers notre schéma

### 18.1 `offers` (brief §4)

| Colonne `offers` | Champ API | Remarques |
|---|---|---|
| `source` | constante `api_alternance` | |
| `external_id` | `identifier.partner_label + ":" + identifier.partner_job_id` | Couple invariant côté LBA ; `identifier.id` (nullable) conservé dans `raw` pour `GET /job/v1/offer/{id}` |
| `title` | `offer.title` | |
| `description` | `offer.description` | `desired_skills`, `to_be_acquired_skills`, `access_conditions` restent dans `raw` (utiles au scoring et à la lettre) |
| `contract_type` | `contract.type` | Tableau d'enum `Apprentissage`, `Professionnalisation` ; colonne scalaire dans le brief : à aplatir (première valeur, ou colonne `text[]`), décision à prendre en phase 1 |
| `diploma_level` | `offer.target_diploma.european` | `"3".."7"` ou `null` (niveau visé) |
| `company_name` | `workplace.name`, repli `workplace.legal_name` puis `workplace.brand` | École si `is_delegated` |
| `company_siret` | `workplace.siret` | Nullable ; école si `is_delegated` |
| `company_website` | `workplace.website` | Nullable |
| `location_label` | `workplace.location.address` | Lieu d'exécution |
| `lat` | `workplace.location.geopoint.coordinates[1]` | Ordre GeoJSON `[lng, lat]`, à vérifier sur données réelles |
| `lng` | `workplace.location.geopoint.coordinates[0]` | idem |
| `insee_code` | non fourni par l'API | À dériver par géocodage inverse (Géoplateforme) ou laisser `null` |
| `rome_codes` | `offer.rome_codes` | |
| `published_at` | `offer.publication.creation` | Nullable |
| `expires_at` | `offer.publication.expiration` | Nullable ; aucune valeur par défaut garantie |
| `apply_channel` | `api_alternance` si `apply.recipient_id` non nul, sinon `external_url` | Le canal `email` n'est jamais alimenté par cette source |
| `apply_target` | `apply.recipient_id` ou `apply.url` | |
| `raw` | objet `JobOfferRead` complet | Inclut `apply.phone`, `contract.*`, `workplace.domain.*`, `is_delegated`, `offer.status`, `identifier.id` |

Champs de l'offre sans colonne dédiée mais utiles : `contract.start` (comparaison avec `profiles.availability_date`), `contract.duration`, `contract.remote`, `offer.opening_count`, `is_delegated` (affichage « offre gérée par un CFA »), `apply.phone` (relance).

### 18.2 `companies` (brief §4)

La fiche est construite par `enrich-company` à partir de l'API Recherche d'entreprises (`docs/API_RECHERCHE_ENTREPRISES.md`) ; l'offre fournit les valeurs d'amorçage :

| Colonne `companies` | Champ API | Remarques |
|---|---|---|
| `siret` | `workplace.siret` | Clé de recherche prioritaire (brief §3.2) ; ne pas enrichir sur le SIRET d'une offre `is_delegated` sans signalement |
| `siren` | 9 premiers chiffres de `workplace.siret` | |
| `legal_name` | `workplace.legal_name` | |
| `brand_name` | `workplace.brand`, sinon `workplace.name` | |
| `naf_code`, `naf_label` | `workplace.domain.naf.code`, `workplace.domain.naf.label` | `label` nullable ; libellés NAF de référence dans `docs/reference/naf-rev2-codes-labels.json` |
| `headcount_range` | `workplace.size` | Format `100-199` ; à réconcilier avec les tranches d'effectifs de l'API Recherche d'entreprises |
| `address`, `postal_code`, `city` | `workplace.location.address` (adresse du lieu d'exécution, pas nécessairement le siège) | Le siège vient de l'API Recherche d'entreprises |
| `website` | `workplace.website` | Point d'entrée du fetch de site (brief §3.3) |
| `executives`, `summary`, `summary_generated_at` | non fournis | API Recherche d'entreprises et LLM |

`workplace.domain.opco`, `workplace.domain.idcc` et `workplace.description` n'ont pas de colonne : les garder dans `offers.raw` (la description de l'employeur peut nourrir le résumé entreprise).

### 18.3 `profiles` → paramètres de recherche et de candidature

| Colonne `profiles` | Paramètre ou champ API | Remarques |
|---|---|---|
| `rome_codes` (2 à 5 codes) | `romes` joint par des virgules | Chaque code `^[A-Z]\d{4}$` |
| `location_lat`, `location_lng` | `latitude`, `longitude` | Toujours ensemble ; `insee_code` non utilisé par l'API |
| `search_radius_km` (défaut 30) | `radius` | Borner à 200 |
| `diploma_level` | `target_diploma_level` | Mapping §12, `bac+4` → `6` à valider ; niveau visé, pas niveau actuel |
| `target_contract` | aucun paramètre | L'API ne filtre pas sur `contract.type` ; filtrer localement (`Apprentissage` et `Professionnalisation` couvrent l'alternance ; `stage` est hors périmètre de cette API) |
| `first_name`, `last_name` | `applicant_first_name`, `applicant_last_name` | 1 à 50 caractères, sans URL |
| `email` | `applicant_email` | Pas d'e-mail jetable ; identifie le candidat pour les quotas |
| `phone` | `applicant_phone` | Obligatoire pour envoyer ; E.164 |
| `availability_date` | aucun paramètre | Comparer localement avec `contract.start` |

### 18.4 `documents` et `applications`

| Colonne | Champ API | Remarques |
|---|---|---|
| `documents.storage_path` (kind `cv`) | `applicant_attachment_name`, `applicant_attachment_content` | Nom avec extension `.pdf` ou `.docx`, contenu base64 préfixé `data:<mime>;base64,`, 3 Mo maximum |
| `applications.cover_letter_text` | `applicant_message` | Seul canal pour la lettre ; pas de limite documentée |
| `applications.external_application_id` | `id` de la réponse 202 | ObjectId Mongo |
| `applications.sent_via` | `api_alternance` | |
| `applications.status` | aucun retour API | `sent` au 202 ; `viewed`, `replied_*` en saisie manuelle ; `no_answer` à J+14 calculé localement |
| `offers.apply_target` (canal `api_alternance`) | `recipient_id` du corps | Rafraîchir par `GET /job/v1/offer/{id}` avant envoi |

### 18.5 Jobs (brief §6)

- `sync-offers` : pour chaque couple (ROME, zone) actif, `GET /job/v1/search` avec `romes`, `latitude`, `longitude`, `radius`, `target_diploma_level` ; upsert sur `(source, external_id)` ; suppression logique des offres expirées ou disparues ; logger `warnings` ; respecter 60/min et `retry-after`. Alternative ou complément : `GET /job/v1/export` une fois par jour.
- `send-application` : `GET /job/v1/offer/{id}` (si `identifier.id` connu) pour vérifier `status = Active` et `recipient_id`, puis `POST /job/v1/apply` ; 202 → `sent` + débit du crédit + `external_application_id` ; 400 métier / 403 → `AbortTaskRunError` avec message utilisateur ; 429 → attendre `retry-after` ; 504 / timeout → statut incertain remonté à l'utilisateur, jamais de rejeu.

## 19. Points restant à vérifier

1. **Juridique (bloquant)** : compatibilité du modèle à crédits avec « réservée à des usages non lucratifs », « facturation de l'accès pour des tiers comme des candidats […] interdite » et « ne pas commercialiser les données reçues ». À demander par écrit à `support_api@apprentissage.beta.gouv.fr` avant la phase 2.
2. **Habilitation (bloquant)** : obtention de `applications:write` en production pour Candidatly (critères, délai, organisation à déclarer), sachant que l'usage individuel est refusé. Sans habilitation, seul le canal `external_url` (ou le widget `/postuler`) reste possible en production.
3. **Aucun appel authentifié n'a été fait** : à valider dès qu'une clé production existe : ordre réel des coordonnées `geopoint`, présence effective de `recipient_id` par `partner_label`, part des offres à `identifier.id` null, format réel de `recipient_id` (`partners_<ObjectId>` déduit du code), présence des en-têtes `x-ratelimit-*` et `retry-after`.
4. **Offres France Travail** : la spécification dit `id = null`, le code courant les lit depuis la base (avec `id`). Accepter les deux cas ; mesurer sur données réelles avant de figer les hypothèses de `sync-offers`.
5. **Code HTTP de dépassement de quota** : 429 selon le serveur, 419 selon les réponses documentées ; traiter les deux jusqu'à observation.
6. **Corps des 429 métier de LBA** (« Maximum application per … reached ») : format Boom inféré, non observé.
7. **Limite de 20 candidatures par jour et par SIRET pour toute l'organisation** : codée en dur ; demander au support si un aménagement est possible pour un service multi-utilisateurs.
8. **Nombre de codes ROME par requête** : aucune limite trouvée ; vérifier en pratique (longueur d'URL, temps de réponse) avec 5 codes.
9. **Export ou recherche comme source principale de `sync-offers`** : décision de phase 2 (fraîcheur quotidienne contre plafond de 150 par source) ; format exact du fichier d'export non documenté.
10. **Mapping `bac+4` → niveau `6`** et sens de `profiles.diploma_level` (actuel ou visé) : à valider par l'owner.
11. **Routes publiques non documentées `/api/rome`** de La bonne alternance : usage limité au développement, ou abstention ; à trancher.
12. **Liste courante des `partner_label`** et des partenaires candidatables : Metabase mort ; à mesurer empiriquement.
13. **1jeune1solution et Indeed** cités dans le brief : le premier semble être un consommateur de l'API plutôt qu'une source, le second n'apparaît nulle part.
14. **Durée maximale de cache** : aucune règle publiée ; le TTL de 6 h du brief est conservé par défaut.
15. **Comportement des e-mails en sandbox** (envoi réel, boîte de destination) : non documenté, à tester avec une clé sandbox.
16. **Engagement de maintien de la route `apply`** : produit « Arrêté » sur beta.gouv.fr depuis avril 2024 mais releases actives en 2026 ; à confirmer avec le support.
17. **Paramètre `elligibleHandicapFilter`**, tag « Experimental », `GET /geographie/v1/commune/search` : présents dans le code ou la spec, non testés, hors périmètre.
18. **`insee_code` des offres** : non fourni par l'API ; choisir entre géocodage inverse et `null`.
19. **`contract.type` tableau contre colonne scalaire `contract_type`** : décision de schéma en phase 1.

## 20. Sources

Portail et API :

- https://api.apprentissage.beta.gouv.fr/api/documentation/json (spécification OpenAPI, version `a18de31`)
- https://api.apprentissage.beta.gouv.fr/api/documentation/json?lang=fr
- https://api.apprentissage.beta.gouv.fr/api/healthcheck
- https://api.apprentissage.beta.gouv.fr/api/job/v1/search?romes=M1805 (401 observé)
- https://api.apprentissage.beta.gouv.fr/api/job/v1/apply (401 observé)
- https://api.apprentissage.beta.gouv.fr/fr/documentation-technique
- https://api.apprentissage.beta.gouv.fr/fr/explorer/recherche-offre
- https://api.apprentissage.beta.gouv.fr/fr/explorer/recuperation-detail-offre
- https://api.apprentissage.beta.gouv.fr/fr/explorer/candidature-offre
- https://api.apprentissage.beta.gouv.fr/fr/compte/profil
- https://api.apprentissage.beta.gouv.fr/cgu et https://api.apprentissage.beta.gouv.fr/fr/cgu
- Copies locales : `docs/reference/api-alternance.openapi.json`, `docs/reference/api-alternance.openapi.fr.json`

Dépôt `mission-apprentissage/api-apprentissage` :

- https://github.com/mission-apprentissage/api-apprentissage
- https://github.com/mission-apprentissage/api-apprentissage/releases
- https://github.com/mission-apprentissage/api-apprentissage/releases/tag/sdk%402.17.0
- https://api.github.com/repos/mission-apprentissage/api-apprentissage/releases?per_page=8
- https://api.github.com/repos/mission-apprentissage/api-apprentissage/git/trees/main?recursive=1
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/shared/src/routes/_private/user.routes.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/ui/app/%5Blang%5D/compte/profil/components/GenerateApiKey.tsx
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/server/src/config.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/server/src/jobs/apiKey/apiKeyExpiration.notifier.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/shared/src/models/user.model.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/server/src/actions/users.actions.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/server/src/migrations/20260825120000-api-key-env.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/sdk/src/routes/security/permissions.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/sdk/src/routes/jobs/job.routes.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/server/src/server/routes/job/job.routes.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/server/src/server/routes/job/job.route.test.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/server/src/server/server.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/server/src/services/forward/forwardApi.service.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/sdk/src/docs/routes/jobSearch/fr/parameters/target_diploma_level.md
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/sdk/src/docs/routes/jobSearch/fr/response/jobs.md
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/sdk/src/openapi/openapiSpec.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/sdk/README.md
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/ui/app/i18n/locales/fr/inscription-connexion.json
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/ui/app/%5Blang%5D/politique-confidentialite/components/PolitiqueConfidentialite.tsx
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/ui/app/%5Blang%5D/mentions-legales/components/MentionLegales.tsx

Dépôt `mission-apprentissage/labonnealternance` :

- https://github.com/mission-apprentissage/labonnealternance
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/helpers/zod-helpers/zod-primitives.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/constants/regex.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/routes/v3/jobs/jobs.routes.v3.model.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/src/services/jobs/job-opportunity/job-opportunity.service.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/src/services/jobs/job-opportunity/job-opportunity-request-context.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/models/jobs-partners.model.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/models/applications.model.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/constants/recruteur.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/src/migrations/20260626000000-update-diploma-labels-jobs-partners.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/routes/rome.routes.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/src/services/application.service.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/src/jobs/offre-partenaire/close-jobs-partners-on-application-threshold.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/src/http/controllers/v2/application.controller.v2.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/src/jobs/jobs.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/constants/error-codes.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/src/config.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/src/services/mailer.service.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/static/templates/mail-candidature.mjml.ejs
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/static/templates/mail-candidat-offre-emploi.mjml.ejs
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/constants/application.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/validators/phone-validator.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/src/jobs/anonymization/anonymize-applications.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/server/src/jobs/applications/process-applications.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/ui/app/(candidat)/postuler/PostulerPage.tsx

Site La bonne alternance :

- https://labonnealternance.apprentissage.beta.gouv.fr/api/v1/jobs?romes=M1805&caller=candidatly (404 observé)
- https://labonnealternance.apprentissage.beta.gouv.fr/api/v3/jobs/search?romes=M1805 (401 observé)
- https://labonnealternance.apprentissage.beta.gouv.fr/api/version
- https://labonnealternance.apprentissage.beta.gouv.fr/espace-developpeurs
- https://labonnealternance.apprentissage.beta.gouv.fr/api/rome?title=developpeur&withRomeLabels=true
- https://labonnealternance.apprentissage.beta.gouv.fr/api/rome/detail/M1805
- https://labonnealternance.apprentissage.beta.gouv.fr/metabase/public/question/70f84c13-6156-4933-9fb3-54c88887d95d (mort)
- https://labonnealternance.apprentissage.beta.gouv.fr/conditions-generales-utilisation
- https://labonnealternance.apprentissage.beta.gouv.fr/politique-de-confidentialite

Autres :

- https://mission-apprentissage.notion.site/Liste-des-partenaires-de-La-bonne-alternance-3e9aadb0170e41339bac486399ec4ac1
- https://beta.gouv.fr/startups/api.apprentissage.html
- https://www.data.gouv.fr/dataservices/api-la-bonne-alternance
- https://www.data.gouv.fr/dataservices/672cf64ff8b5d52b76263394
- https://www.data.gouv.fr/api/1/dataservices/672cf64ff8b5d52b76263394/
- https://github.com/etalab/licence-ouverte/blob/master/LO.md et https://raw.githubusercontent.com/etalab/licence-ouverte/master/LO.md
- https://raw.githubusercontent.com/mission-apprentissage/upptime/master/README.md
- https://raw.githubusercontent.com/mission-apprentissage/upptime/master/.upptimerc.yml
- https://mission-apprentissage.github.io/upptime/ (le lien `/history/api-apprentissage-api` du portail répond 404)
- https://api.gouv.fr/guides/widget-la-bonne-alternance
- https://github.com/Dymayo/alternances-tech-2026 (README communautaire, source secondaire citée pour la clause d'usage non lucratif, confirmée ensuite sur le portail)
