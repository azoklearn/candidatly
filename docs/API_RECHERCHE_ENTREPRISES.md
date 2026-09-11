# API Recherche d'entreprises (recherche-entreprises.api.gouv.fr)

Dernière vérification : 9 septembre 2026

Document de référence interne pour l'intégration de l'API Recherche d'entreprises dans Candidatly (`lib/enrichment/recherche-entreprises.ts`, job `enrich-company`). Il est rédigé à partir de l'OpenAPI officiel, de requêtes réelles exécutées les 8 et 9 septembre 2026, du code source public du service et des pages data.gouv.fr et INSEE citées en fin de document. Tout ce qui n'a pas pu être confirmé par une seconde source est précédé de « ⚠️ Non vérifié : ».

Fichiers de référence bruts sauvegardés dans `docs/reference/` :

| Fichier | Contenu | Origine |
|---|---|---|
| `recherche-entreprises.openapi.json` (51 514 octets) | OpenAPI 3.0.0 servi par l'API, identique octet pour octet à la version en ligne au 9 septembre 2026 | `https://recherche-entreprises.api.gouv.fr/openapi.json` |
| `recherche-entreprises.sample.json` (15 échantillons, `_meta.fetched_at` 2026-09-09) | Réponses réelles tronquées : nom + code postal, SIRET direct, SIREN direct, `minimal` + `score`, `/near_point`, 7 erreurs 400, 1 cas 200 vide, 404, 429 | Requêtes GET réelles, `User-Agent: candidatly-research/0.1` |
| `recherche-entreprises.tranches-effectifs.json` | Table code de tranche d'effectifs vers libellé (16 entrées) | Dépôt `search-api`, `app/labels/tranches-effectifs.json` (fichier lié depuis l'OpenAPI) |
| `naf-rev2-codes-labels.json` | 732 codes NAF rév. 2 vers libellé | Dépôt `search-api`, `app/labels/codes-NAF.json` |

## Résumé en 5 points

1. **Accès libre, sans clé, sans compte.** Base `https://recherche-entreprises.api.gouv.fr`, appels `GET` uniquement, aucune authentification, CORS ouvert. Seule exigence exprimée : un en-tête `User-Agent` explicite. Nous appelons l'API exclusivement côté serveur (job Trigger.dev).
2. **Deux routes documentées : `GET /search` (recherche textuelle ou directe par SIREN / SIRET) et `GET /near_point` (recherche géographique).** Pour Candidatly : `GET /search?q=<SIRET 14 chiffres>` quand l'offre fournit un SIRET (le résultat est l'unité légale, `matching_etablissements` contient uniquement l'établissement demandé, `siege` est le siège), sinon `GET /search?q=<nom>&code_postal=<5 chiffres>`. Au plus 25 résultats par page, 10 000 résultats atteignables au total.
3. **Pas de libellé NAF, pas de site web, pas d'email dans l'API.** Elle renvoie uniquement des codes (`activite_principale` en NAF rév. 2, `activite_principale_naf25` en NAF 2025, `tranche_effectif_salarie`, `nature_juridique`). Les tables de libellés doivent être embarquées localement (fichiers dans `docs/reference/`). L'URL du site web vient de l'offre.
4. **Quota : 7 requêtes par seconde par adresse IP et 30 par seconde par ASN, limite maximale non garantie.** Au-delà, HTTP 429 émis soit par nginx (corps HTML, sans `Retry-After`), soit par l'application (corps texte, `retry-after: 3`). Prévoir un backoff autonome, honorer `Retry-After` quand il est présent, ne jamais supposer un corps JSON sur une 429.
5. **Données sous Licence Ouverte 2.0, dirigeants issus de l'INPI avec droit d'opposition.** Aucune CGU propre à l'API. La recherche textuelle n'est pas tolérante aux fautes de frappe et le score de pertinence (`score`) est brut, non normalisé, non comparable entre requêtes : le score de confiance exigé par le brief doit être construit de notre côté. Ne jamais afficher ni stocker la date de naissance des dirigeants ; rejeter les résultats en diffusion partielle (`statut_diffusion = "P"` ou valeur littérale `[NON-DIFFUSIBLE]`).

## 1. Ce que le projet attend de cette API

Rappel du brief (`docs/BRIEF.md`) :

- §3.2 : enrichir chaque offre avec raison sociale, SIREN / SIRET, code NAF et libellé, tranche d'effectifs, adresse du siège, dirigeants, date de création. Recherche par SIRET si l'offre le fournit, sinon par nom + code postal avec un score de confiance ; si le score est faible, les données ne sont pas affichées.
- §4 : la table `companies` (`siret`, `siren`, `legal_name`, `brand_name`, `naf_code`, `naf_label`, `headcount_range`, `address`, `postal_code`, `city`, `website`, `executives`, `summary`, `summary_generated_at`) est la cible. Les entrées sont `offers.company_siret`, `offers.company_name` et le code postal de l'offre.
- §6 : le job `enrich-company` est déclenché à la création d'une offre avec un SIRET ou un couple nom + code postal inconnu ; il enchaîne cette API, le fetch du site web et le résumé LLM (§6.2, qui attend notamment « taille, localisation, âge »).

Le mapping champ par champ est en section 15.

## 2. Accès, authentification, documentation

### 2.1 Base, protocole, authentification

| Élément | Valeur |
|---|---|
| URL de base | `https://recherche-entreprises.api.gouv.fr` (seul serveur déclaré dans l'OpenAPI, « Serveur de production ») |
| Authentification | Aucune. L'OpenAPI ne déclare aucun `securitySchemes` ; toutes les requêtes de test ont réussi sans clé ni jeton. |
| Obtention d'identifiants | Sans objet : il n'y a ni inscription ni clé à créer. Rien à stocker dans `lib/env.ts` en dehors de l'URL de base et du `User-Agent`. |
| Méthodes | `GET` (et `HEAD`) sur les routes documentées. `OPTIONS /search` renvoie 405 avec `allow: HEAD, GET`. |
| Format | Réponses `application/json`, sauf les 429 émises par nginx (`text/html`) et par l'application (`application/octet-stream`), voir section 9. |
| En-tête recommandé | `User-Agent` « explicite et descriptif » (texte de l'OpenAPI). Nous utiliserons `candidatly/<version> (<adresse de contact>)`. |
| CORS | `access-control-allow-origin: *` et `access-control-allow-headers: Content-Type` sur les GET et sur la 405 ; le preflight OPTIONS n'est pas géré. Sans conséquence pour nous : appels côté serveur uniquement. |

### 2.2 Documentation et catalogue

- Documentation interactive : `https://recherche-entreprises.api.gouv.fr/docs/` (page ReDoc qui charge `/openapi.json`).
- Spécification : `https://recherche-entreprises.api.gouv.fr/openapi.json` (OpenAPI 3.0.0, `info.version` 1.0.0, `info.license` MIT). Les chemins `/docs/openapi.json`, `/openapi.yaml`, `/swagger.json`, `/api/openapi.json`, `/api/documentation/json` renvoient 404 `{"erreur":"Ressource non trouvée."}`.
- Fiche catalogue : `https://api.gouv.fr/les-api/api-recherche-entreprises` redirige (301) vers `https://www.data.gouv.fr/dataservices/672cf684c3488a0c533f7094`. Producteur : Direction interministérielle du numérique (DINUM), partenaires INSEE et INPI. Accès « Ouvert », quota affiché « 7 appels / seconde », disponibilité affichée 100 %, licence « Open Licence 2.0 » (dans le rendu HTML uniquement ; le champ `license` de l'API JSON de data.gouv est `null`). Métadonnées : `created` 2024-11-07, `metadata_modified` 2026-06-03.
- Code source : `https://github.com/annuaire-entreprises-data-gouv-fr/search-api` (l'ancien dépôt `etalab/annuaire-entreprises-search-api` redirige en 301). Branche `main`, licence MIT, dernier push `2026-09-09T09:33:15Z` (commit « build: upgrade dependencies (#775) »). Le dépôt n'a ni dossier `docs/`, ni `CHANGELOG`, ni release, ni tag : il n'existe pas de journal de versions ; la seule façon de suivre les changements est l'historique des commits. La spécification source est `app/doc/open-api.yml` (69 123 octets, `version: 1.0.0`). Stack : Elasticsearch, FastAPI, Sentry.
- Contact : formulaire `https://annuaire-entreprises.data.gouv.fr/faq/parcours?question=contact`. ⚠️ Non vérifié : un canal Tchap `#annuaire-entreprises:agent.dinum.tchap.gouv.fr` est mentionné dans le dépôt, non testé.
- Supervision temps réel : `https://annuaire-entreprises.data.gouv.fr/donnees/api#recherche-entreprise`. Attention : tout le site `annuaire-entreprises.data.gouv.fr` (pages vie privée, FAQ, sources, monitoring) est protégé par Incapsula et a bloqué `curl`, le fetch automatisé et le navigateur intégré. Les contenus cités dans ce document proviennent du dépôt GitHub du site (`annuaire-entreprises-data-gouv-fr/site`, branche `main`) et peuvent différer de la version publiée.

### 2.3 Inventaire des routes

L'OpenAPI ne déclare que `/search` et `/near_point`, mais l'API en production sert d'autres routes, visibles dans `app/routers/public.py` et `app/routers/admin.py` du dépôt et joignables sans clé :

| Route | Documentée dans l'OpenAPI | Usage pour Candidatly |
|---|---|---|
| `GET` / `HEAD` `/search` | Oui | Route principale (section 3) |
| `GET` / `HEAD` `/near_point` | Oui | Non utilisée au MVP (section 4) |
| `GET` / `HEAD` `/fondation` | Non | Répertoire National des Fondations ; hors périmètre (section 5) |
| `GET /sources/last_modified` | Non | Date de dernière mise à jour par source ; utile pour la supervision de fraîcheur (section 5) |
| `GET /idcc/metadata`, `GET /idcc/{siren}` | Non | Conventions collectives ; hors périmètre |

Les routes non documentées peuvent changer sans préavis : ne pas en dépendre dans le chemin critique.

## 3. `GET /search` : recherche textuelle ou directe

Résumé officiel : « Recherche textuelle ». Récupère les unités légales et les établissements correspondant à la recherche sur la dénomination, l'adresse, les dirigeants et les élus, ou bien par numéro SIREN / SIRET.

### 3.1 Deux modes selon la valeur de `q`

- **Recherche textuelle classique** (dénomination, adresse, dirigeants, élus) : tous les filtres optionnels (`code_commune`, `code_postal`, `departement`, `region`, `epci`, etc.) sont combinés avec la recherche.
- **Recherche directe par SIREN ou SIRET** : si `q` contient exactement 9 chiffres (SIREN) ou 14 chiffres (SIRET), l'API effectue une recherche directe et **ignore tous les autres filtres**, sans erreur. Vérifié : `q=81280923400030&code_postal=13001` renvoie quand même l'établissement du 75011. La validation de format des filtres s'applique toutefois avant : `q=81280923400030&code_postal=99999` renvoie 400.
- Détection (code `app/elastic/parsers/siren.py` et `siret.py`) : les espaces sont retirés puis les regex `^\d{9}$` et `^\d{14}$` sont appliquées. Vérifié : `q=812 809 234 00030` est traité comme un SIRET. ⚠️ Non vérifié : les tirets ne sont pas retirés par le code (non testé) ; normaliser le SIRET côté Candidatly (chiffres uniquement) avant l'appel.
- Les préfixes `q=siren:130025265` et `q=siret:81280923400030` visibles dans le README du dépôt **ne fonctionnent pas** : HTTP 200 avec `total_results: 0`. De même, le README mentionne un filtre `code_naf` qui n'existe pas : le paramètre s'appelle `activite_principale`.
- Comportement côté moteur : SIREN = requête `term` sur `unite_legale.siren` (premier hit) ; SIRET = requête `nested` sur `unite_legale.etablissements.siret` avec `inner_hits`, ce qui explique que seul l'établissement demandé figure dans `matching_etablissements`.

### 3.2 Paramètres

Tous les paramètres sont passés en query string. Aucun n'est marqué `required` dans l'OpenAPI, mais au moins un paramètre de recherche est obligatoire (sinon 400). Toutes les listes sont séparées par des virgules, sans espace.

| Paramètre | Type | Obligatoire | Valeurs et contraintes | Défaut | Notes |
|---|---|---|---|---|---|
| `q` | string | Non (mais au moins un paramètre de recherche est requis) | Termes libres (dénomination, adresse, dirigeants, élus) ou SIREN (9 chiffres) ou SIRET (14 chiffres). Minimum 3 caractères si aucun autre filtre n'est fourni. | | Recherche directe si 9 ou 14 chiffres (section 3.1). Insensible à la casse et aux accents. |
| `activite_principale` | string | Non | Code NAF / APE au format `NN.NNL` (ex. `01.12Z,28.15Z`), validé contre la table de 732 codes NAF rév. 2 | | Ne s'applique qu'à l'unité légale, pas à ses établissements. |
| `section_activite_principale` | string | Non | Lettres `A` à `U` (21 sections NAF rév. 2), liste possible (ex. `A,J,U`) | | Sections : A Agriculture, sylviculture et pêche ; B Industries extractives ; C Industrie manufacturière ; D Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné ; E Production et distribution d'eau, assainissement, gestion des déchets et dépollution ; F Construction ; G Commerce ; H Transports ; I Hébergement et restauration ; J Information et communication ; K Finance et assurance ; L Immobilier ; M Activités spécialisées, scientifiques et techniques ; N Services administratifs et de soutien ; O Administration publique ; P Enseignement ; Q Santé humaine et action sociale ; R Arts et spectacles ; S Autres services ; T Ménages employeurs ; U Activités extra-territoriales. |
| `categorie_entreprise` | string | Non | Enum `PME`, `ETI`, `GE`, liste possible | | Catégorie INSEE de l'unité légale. |
| `code_collectivite_territoriale` | string | Non | Ex. `75C`. Commune : code INSEE ; EPCI : n° SIREN ; Département : code INSEE + « D » (sauf cas particulier) ; Région : code INSEE | | |
| `convention_collective_renseignee` | boolean | Non | `true` / `false` | | Entreprises ayant au moins un établissement dont la convention collective est renseignée. |
| `code_postal` | string | Non | 5 chiffres, liste possible (ex. `38540,38189`). Regex de validation dans le code : `^((0[1-9])\|([1-8][0-9])\|(9[0-8])\|(2A)\|(2B))[0-9]{3}$` | | **Filtre sur les établissements.** Valeur invalide : 400 « Au moins une valeur du paramètre code_postal est non valide. » |
| `code_commune` | string | Non | Code commune INSEE en 5 caractères, liste possible (ex. `01247,01111`). Regex dans le code : `^([013-9]\d\|2[AB1-9])\d{3}$` | | Filtre sur les établissements. |
| `departement` | string | Non | 2 ou 3 chiffres, liste possible (ex. `02,89`). Pattern OpenAPI : `\b([013-8]\d?\|2[aAbB1-9]?\|9[0-59]?\|97[12346])\b` | | Filtre sur les établissements. |
| `region` | string | Non | Code région en 2 chiffres, liste possible (ex. `11,76`) | | Filtre sur les établissements. |
| `epci` | string | Non | SIREN d'EPCI (9 chiffres, regex `^\d{9}$`), liste possible | | Filtre sur les établissements. |
| `egapro_renseignee`, `est_achats_responsables`, `est_alim_confiance`, `est_association`, `est_bio`, `est_collectivite_territoriale`, `est_entrepreneur_individuel`, `est_entrepreneur_spectacle`, `est_ess`, `est_finess`, `est_organisme_formation`, `est_patrimoine_vivant`, `est_qualiopi`, `est_rge`, `est_siae`, `est_administration`, `est_societe_mission`, `est_uai` | boolean | Non | `true` / `false` | | Filtres thématiques. `est_association` : identifiant d'association ou nature juridique 5195, 9210, 9220, 9221, 9222, 9223, 9224, 9230, 9240, 9260. `est_administration` : basé sur une liste non exhaustive, faux positifs possibles. |
| `etat_administratif` | string | Non | Enum `A` (Active), `C` (Cessée) | | Unité légale. Autre valeur : 400 « Le paramètre etat_administratif doit prendre une des valeurs suivantes ['A', 'C']. » |
| `id_convention_collective` | string | Non | IDCC (ex. `1090`) | | Convention collective d'un établissement. |
| `id_finess` | string | Non | 9 chiffres | | FINESS géographique d'un établissement. |
| `id_rge` | string | Non | Ex. `8611M10D109` | | |
| `id_uai` | string | Non | Ex. `0022004T` | | |
| `nature_juridique` | string | Non | Code catégorie juridique INSEE (ex. `7344,6544`), liste possible, validé contre une table de 260 codes | | Unité légale. |
| `tranche_effectif_salarie` | string | Non | `NN`, `00`, `01`, `02`, `03`, `11`, `12`, `21`, `22`, `31`, `32`, `41`, `42`, `51`, `52`, `53`, liste possible | | Autre valeur : 400 listant les valeurs valides. Libellés en section 7. |
| `nom_personne`, `prenoms_personne` | string | Non | Texte libre | | Dirigeant ou élu. |
| `date_naissance_personne_min`, `date_naissance_personne_max` | string | Non | Date `AAAA-MM-JJ` ; min doit être inférieure à max | | |
| `type_personne` | string | Non | Enum `dirigeant`, `elu` | | |
| `ca_min`, `ca_max`, `resultat_net_min`, `resultat_net_max` | integer | Non | Entiers 64 bits signés | | Chiffre d'affaires et résultat net de l'entreprise. |
| `limite_matching_etablissements` | integer | Non | 1 à 100 | 10 | Nombre d'établissements dans `matching_etablissements`. Hors bornes : 400 dont le message nomme le paramètre interne `matching_size`. |
| `page_etablissements` | integer | Non | 1 à 1000 | 1 | Pagination de `matching_etablissements`. |
| `minimal` | boolean | Non | `true` / `false` | `false` | Réponse minimale, sans les champs secondaires. |
| `include` | string | Non | Liste parmi `complements`, `dirigeants`, `finances`, `matching_etablissements`, `siege`, `score`, `tva` | | **Utilisable uniquement avec `minimal=true`** (sinon 400). Sans `minimal`, tous les champs secondaires sont inclus sauf `score`. Valeur inconnue : 400 listant les valeurs valides. |
| `page` | integer | Non | 1 à 1000 | 1 | |
| `per_page` | integer | Non | 1 à 25 | 10 | |
| `sort_by_size` | boolean | Non | `true` / `false` | | Tri par taille d'entreprise (nombre d'établissements). |

Contrainte globale : `page * per_page` ne doit pas excéder 10 000 (le nombre total de résultats atteignables est plafonné à 10 000). Vérifié : `q=boulangerie&per_page=25` renvoie `total_results: 10000` et `total_pages: 400` ; `page=400` fonctionne, `page=401` renvoie 400.

Paramètre non documenté : le code (`search_params_model.py`, `field_validation.py`) valide aussi `include_admin` avec les valeurs `ETABLISSEMENTS`, `IMMATRICULATION`, `BODACC`, `ADMIN`, et des gestionnaires correspondants existent dans `format_search_results.py`. ⚠️ Non vérifié : non testé sur le service public, probablement réservé aux agents ; à considérer comme hors périmètre.

### 3.3 Exemples de requêtes

Recherche directe par SIRET (cas nominal Candidatly) :

```bash
curl -sS -H 'User-Agent: candidatly/0.1 (contact@example.invalid)' \
  'https://recherche-entreprises.api.gouv.fr/search?q=81280923400030'
```

Même recherche en réponse minimale, en ne demandant que ce dont nous avons besoin :

```bash
curl -sS -H 'User-Agent: candidatly/0.1 (contact@example.invalid)' \
  'https://recherche-entreprises.api.gouv.fr/search?q=81280923400030&minimal=true&include=siege,dirigeants,matching_etablissements,complements'
```

Recherche par nom et code postal avec score (cas de repli) :

```bash
curl -sS -H 'User-Agent: candidatly/0.1 (contact@example.invalid)' \
  'https://recherche-entreprises.api.gouv.fr/search?q=Capgemini&code_postal=92130&per_page=5&minimal=true&include=siege,dirigeants,matching_etablissements,score'
```

Recherche directe par SIREN (`matching_etablissements` sera vide) :

```bash
curl -sS -H 'User-Agent: candidatly/0.1 (contact@example.invalid)' \
  'https://recherche-entreprises.api.gouv.fr/search?q=812809234'
```

Toujours encoder `q` avec `URLSearchParams` (espaces, accents, apostrophes).

### 3.4 Réponses

- `200` : objet `payload` (section 6). Un SIRET ou SIREN inconnu renvoie **200 avec `results` vide**, jamais 404 : `{"results":[],"total_results":0,"page":1,"per_page":10,"total_pages":0}`.
- `400` : `{"erreur": "<message en français>"}`. Liste des messages en section 10.
- `404` : `{"erreur":"Ressource non trouvée."}` sur un chemin inconnu.
- `429` : dépassement de quota (section 9).

## 4. `GET /near_point` : recherche géographique

Résumé officiel : « Recherche géographique ». Prend une latitude et une longitude et renvoie les unités légales et leurs établissements autour de ces coordonnées, dans un rayon en kilomètres. Non utilisée au MVP (le brief ne prévoit pas de recherche d'entreprises par proximité), documentée pour référence.

| Paramètre | Type | Obligatoire | Valeurs et contraintes | Défaut | Notes |
|---|---|---|---|---|---|
| `lat` | number | Oui | -90 à 90 | | Latitude. |
| `long` | number | Oui | -180 à 180 | | Longitude. Le message d'erreur hors bornes nomme le paramètre `lon` alors que la query attend `long`. |
| `radius` | number | Non | 0.001 à 50 (km) | 5 | |
| `activite_principale` | string | Non | Comme `/search` | | |
| `section_activite_principale` | string | Non | Comme `/search` | | |
| `limite_matching_etablissements` | integer | Non | 1 à 100 | 10 | |
| `minimal` | boolean | Non | | `false` | |
| `include` | string | Non | L'OpenAPI liste `complements`, `dirigeants`, `finances`, `matching_etablissements`, `siege`, `score` (sans `tva`), mais le validateur est commun aux deux routes et `include=tva` fonctionne (vérifié : `GET /near_point?lat=48.85&long=2.35&minimal=true&include=tva&per_page=1` renvoie `tva: ["FR39356000000"]`). | | Uniquement avec `minimal=true`. |
| `page` | integer | Non | 1 à 1000 | 1 | |
| `per_page` | integer | Non | 1 à 25 | 10 | |
| `page_etablissements` | integer | Non | 1 à 1000 | 1 | |
| `sort_by_size` | boolean | Non | | | |

- `q` n'est pas accepté sur cette route (code : « Le paramètre 'terms' n'est pas autorisé pour une recherche géographique »).
- `lat` ou `long` manquant : 400 « Les paramètres 'lat' et 'long' sont obligatoires pour une recherche géographique. » Hors bornes : « Veuillez indiquer un paramètre `lat` entre `-90` et `90`, par défaut `None`. » et « ... `lon` entre `-180` et `180` ... ». `radius` hors bornes : « Veuillez indiquer un paramètre radius entre 0.001 et 50, par défaut 5. »
- Vérifié : `GET /near_point?lat=48.8566&long=2.3522&radius=0.5&per_page=2` renvoie 200, `total_results: 10000`, `total_pages: 5000`, même schéma `payload` que `/search`.

```bash
curl -sS -H 'User-Agent: candidatly/0.1 (contact@example.invalid)' \
  'https://recherche-entreprises.api.gouv.fr/near_point?lat=48.8566&long=2.3522&radius=0.5&per_page=2'
```

## 5. Routes non documentées (information, hors périmètre)

- `GET` / `HEAD` `/fondation` : recherche dans le Répertoire National des Fondations, même pagination que `/search`. Champs renvoyés : `numero_rnf`, `denomination`, `type_organisme`, `date_creation`, `adresse`, `code_postal`, `ville`, `siren`, `siret`. Ajoutée le 2026-07-28 (commit « feat(fondation): add fondation endpoint (#752) »), filtre `siren` ajouté le 2026-08-25 (#769). Vérifié : `GET /fondation?q=fondation%20de%20france&per_page=1` renvoie 200 avec `total_results: 59`.
- `GET /sources/last_modified` : date de dernière mise à jour par source. Valeurs observées le 2026-09-09 : `sirene` 2026-09-08, `rge` 2026-09-07, `bilan_financier` 2026-06-01, `finess` 2026-05-12, `ess_france` 2023-11-20 (source visiblement figée). C'est le meilleur indicateur disponible de la fraîcheur de l'index, utilisable pour un contrôle périodique dans le runbook.
- `GET /idcc/metadata`, `GET /idcc/{siren}` : conventions collectives.

Ces routes sont définies dans `app/routers/public.py` (`/fondation`) et `app/routers/admin.py` (les autres) et sont accessibles sans authentification, mais rien ne garantit leur stabilité.

## 6. Format de réponse

### 6.1 Enveloppe `payload`

| Champ | Type | Description |
|---|---|---|
| `results` | array de `result` | Unités légales trouvées. |
| `total_results` | integer | Nombre total de résultats, **plafonné à 10 000**. |
| `page` | integer | Page renvoyée. |
| `per_page` | integer | Résultats par page (max 25). |
| `total_pages` | integer | Nombre de pages (max 1000). |

```json
{ "results": [ { "...": "result" } ], "total_results": 1, "page": 1, "per_page": 10, "total_pages": 1 }
```

### 6.2 Objet `result` (unité légale, 28 champs)

Clés dans l'ordre réel de la réponse. Sauf mention, source INSEE (base SIRENE).

| Champ | Type | Description |
|---|---|---|
| `siren` | string (9 chiffres) | Numéro unique de l'entreprise. |
| `nom_complet` | string | Champ construit (code `nom_complet.py`) : dénomination de l'unité légale, ou « Nom et prénom », ou « Nom inconnu », suivie de la dénomination usuelle du siège entre parenthèses puis du sigle entre parenthèses, le tout en majuscules. Exemples réels : `BOULANGERIE DU NIL`, `CAPGEMINI CONSULTING ()`, `CE CAPGEMINI TS (CE CAPGEMINI TS)`, `SOCIETE GENERALE (SG)`. Attention aux parenthèses vides. |
| `nom_raison_sociale` | string | Raison sociale des personnes morales. Préférer ce champ à `nom_complet` pour `legal_name`. |
| `sigle` | string, nullable | Forme réduite de la raison sociale. |
| `nombre_etablissements` | integer | |
| `nombre_etablissements_ouverts` | integer | |
| `siege` | objet `siege` | Établissement siège (section 6.3). Champ secondaire. |
| `activite_principale` | string | Code APE de l'unité légale, NAF rév. 2 (ex. `10.71C`). **Aucun libellé.** |
| `activite_principale_naf25` | string | Code selon la NAF 2025 (ex. `10.71H`). « Champ temporaire, supprimé à compter du 1er janvier 2027 » (OpenAPI). |
| `categorie_entreprise` | string, nullable en pratique | `PME`, `ETI`, `GE` ; `null` observé sur de petites structures. |
| `caractere_employeur` | string, nullable en pratique | `O` / `N` ; `null` observé. |
| `annee_categorie_entreprise` | string | Année de validité (ex. `2023`). |
| `date_creation` | string `AAAA-MM-JJ` | Date de création de l'unité légale. |
| `date_fermeture` | string, nullable | |
| `date_mise_a_jour` | string datetime | Dernière modification d'une variable de l'unité légale (ex. `2026-09-08T10:15:13`). |
| `date_mise_a_jour_insee` | string datetime, nullable | Dernière mise à jour des données INSEE. |
| `date_mise_a_jour_rne` | string datetime, nullable | Dernière mise à jour des données RNE / RNCS (INPI). |
| `dirigeants` | array de `dirigeant_pp` ou `dirigeant_pm` | `[]` quand aucun. Section 6.5. Champ secondaire. |
| `etat_administratif` | string | `A` (Active) ou `C` (Cessée). |
| `nature_juridique` | string | Code catégorie juridique INSEE (ex. `5499`, `5510`, `5710`). Pas de libellé. |
| `section_activite_principale` | string | Lettre de section, calculée à partir de l'activité principale. |
| `tranche_effectif_salarie` | string | Code de tranche (ex. `12`). Libellés en section 7. |
| `annee_tranche_effectif_salarie` | string | Année de validité (ex. `2023`). |
| `statut_diffusion` | string | `O` diffusible, `P` diffusion partielle. |
| `matching_etablissements` | array d'`etablissement` | Établissements ayant contribué au résultat (match textuel ou filtre établissement). **Jamais la liste complète des établissements.** Recherche directe SIREN : toujours vide. Recherche directe SIRET : uniquement le SIRET demandé. Champ secondaire. |
| `finances` | objet | Clés = année `AAAA`, valeurs `{ "ca": int64, "resultat_net": int64 }`. Champ secondaire. |
| `complements` | objet | Section 6.6. Champ secondaire. |
| `tva` | array de string | Numéros de TVA intracommunautaire français actifs (source DGFiP), ex. `["FR04812809234"]`. Champ secondaire. |
| `score` | number | Présent uniquement avec `minimal=true&include=score`. Valeur `meta.score` brute d'Elasticsearch (ex. `1944.792`), non normalisée. |

### 6.3 Objet `siege` (47 champs)

Établissement siège de l'unité légale. Le schéma OpenAPI, la réponse réelle et l'échantillon sauvegardé concordent sur 47 propriétés (et non 49 comme indiqué dans une première version des notes de recherche).

| Champ | Type | Description |
|---|---|---|
| `siret` | string (14 chiffres) | Numéro unique de l'établissement. |
| `est_siege` | boolean | Toujours `true` ici. |
| `activite_principale` | string | NAF rév. 2 de l'établissement (peut différer de celui de l'unité légale, ex. `70.10Z` pour un siège de holding). |
| `activite_principale_naf25` | string | NAF 2025 de l'établissement. |
| `activite_principale_registre_metier` | string, nullable | Activité au Registre des Métiers. |
| `adresse` | string | Chaîne construite : complément + numéro + indice de répétition + type de voie + libellé de voie + distribution spéciale + code postal + libellé commune (ou cedex, ou commune et pays étranger). Ex. `7 RUE DU NIL 75002 PARIS`. |
| `complement_adresse` | string, nullable | |
| `numero_voie` | string, nullable en pratique | |
| `dernier_numero_voie` | string, nullable en pratique | Dernier numéro quand l'adresse est une plage (ex. « 9-10 »). |
| `indice_repetition` | string, nullable | B pour bis, T pour ter, etc. |
| `type_voie` | string, nullable en pratique | Ex. `RUE`. |
| `libelle_voie` | string, nullable en pratique | Ex. `DU NIL`. |
| `distribution_speciale` | string, nullable | |
| `code_postal` | string, nullable | Ex. `75002`. |
| `cedex`, `libelle_cedex` | string, nullable | |
| `commune` | string | Code INSEE de la commune (ex. `75102`, arrondissement). |
| `libelle_commune` | string | Ex. `PARIS`, `PARIS 15`. |
| `code_pays_etranger`, `libelle_commune_etranger`, `libelle_pays_etranger` | string, nullable | Établissements situés à l'étranger. |
| `departement` | string, nullable | Code département (ex. `75`). |
| `region` | string, nullable | Code région (ex. `11`). |
| `epci` | string, nullable | SIREN de l'EPCI (ex. `200054781`). |
| `latitude`, `longitude` | string | Chaînes (ex. `48.867702377`). Géocodage de la base SIRENE géocodée par l'INSEE, sauf entreprises créées au cours des derniers mois (géolocalisation extraite directement de SIRENE). |
| `coordonnees` | string, nullable | `"lat,long"`. |
| `caractere_employeur` | string | `O` / `N`. |
| `tranche_effectif_salarie` | string, nullable | Code de tranche de l'établissement (ex. `12`, `NN`). |
| `annee_tranche_effectif_salarie` | string, nullable | |
| `date_creation` | string, nullable | |
| `date_debut_activite` | string, nullable | |
| `date_fermeture` | string, nullable | |
| `date_mise_a_jour` | string, nullable | Date du dernier traitement dans Sirene. ⚠️ Non vérifié : signalé comme obsolète dans les notes de recherche ; `null` dans nos échantillons, préférer `date_mise_a_jour_insee`. |
| `date_mise_a_jour_insee` | string, nullable | Date du dernier traitement dans Sirene (ex. `2025-12-06T04:08:31`). |
| `etat_administratif` | string | `A` (Actif) ou `F` (Fermé). |
| `statut_diffusion_etablissement` | string | `O` ou `P`. |
| `nom_commercial` | string, nullable | Dénomination usuelle de l'établissement. |
| `liste_enseignes` | array de string, nullable | Ex. `["LEROY MERLIN"]`. |
| `liste_idcc` | array de string, nullable | Conventions collectives (ex. `["0843"]`). |
| `liste_finess`, `liste_id_bio`, `liste_id_organisme_formation`, `liste_rge`, `liste_uai` | array de string, nullable | Identifiants sectoriels. |
| `geo_adresse`, `geo_id` | string, nullable | **Obsolètes, toujours vides** (OpenAPI). |

### 6.4 Objet `etablissement` (éléments de `matching_etablissements`, 30 champs)

`activite_principale`, `activite_principale_naf25`, `ancien_siege` (boolean : l'établissement était le siège), `annee_tranche_effectif_salarie`, `adresse`, `caractere_employeur`, `code_postal`, `commune`, `date_creation`, `date_debut_activite`, `date_fermeture`, `epci`, `est_siege`, `etat_administratif` (`A` / `F`), `geo_id` (obsolète), `latitude`, `libelle_commune`, `liste_enseignes`, `liste_finess`, `liste_id_bio`, `liste_idcc`, `liste_id_organisme_formation`, `liste_rge`, `liste_uai`, `longitude`, `nom_commercial`, `region`, `siret`, `statut_diffusion_etablissement`, `tranche_effectif_salarie`.

Mêmes types que dans `siege`. Différences : **pas de champs d'adresse décomposés** (`numero_voie`, `type_voie`, `libelle_voie`, etc.), pas de `departement` ni de `coordonnees` ; `adresse`, `code_postal` et `libelle_commune` restent disponibles. ⚠️ Non vérifié : d'après la lecture du code, les établissements matchés sont triés par `etat_administratif` croissant (`A` avant `F`) ; non testé.

### 6.5 Tableau `dirigeants`

Source INPI (RNE). Les deux types sont mélangés dans le même tableau ; discriminer sur `type_dirigeant`.

`dirigeant_pp` (personne physique) :

| Champ | Type | Exemple |
|---|---|---|
| `nom` | string | `DROUARD` |
| `prenoms` | string | `ALEXANDRE` |
| `annee_de_naissance` | string `AAAA` | `1983` |
| `date_de_naissance` | string `AAAA-MM` | `1983-05` |
| `qualite` | string | `Gérant`, `Président de SAS`, `Directeur Général`, `Administrateur`, `Commissaire aux comptes titulaire`, `Commissaire aux comptes suppléant` |
| `nationalite` | string, nullable | `null` dans tous nos échantillons |
| `type_dirigeant` | string | `personne physique` |

`dirigeant_pm` (personne morale) :

| Champ | Type | Exemple |
|---|---|---|
| `siren` | string | `632013843` |
| `denomination` | string | `GRANT THORNTON` |
| `qualite` | string | `Commissaire aux comptes titulaire` |
| `type_dirigeant` | string | `personne morale` |

La liste inclut les commissaires aux comptes (personnes physiques et morales) : filtrer les qualités contenant « Commissaire aux comptes » avant affichage. Contraintes RGPD en section 12.

### 6.6 Objet `complements` (32 clés réelles, 30 documentées)

Les réponses réelles renvoient 32 clés ; l'OpenAPI n'en documente que 30 : `a_aide_minimis` et `a_aide_ademe` sont renvoyées mais absentes du schéma. Le schéma Zod doit donc être tolérant (`passthrough`) sur cet objet.

| Clé | Type | Notes |
|---|---|---|
| `collectivite_territoriale` | objet `{ code, code_insee, elus[], niveau }` ou null | Les `elu` ont `nom`, `prenoms`, `annee_de_naissance`, `fonction`, `sexe`. |
| `convention_collective_renseignee` | boolean | |
| `liste_idcc` | array, nullable | |
| `liste_finess_juridique` | array, nullable | |
| `numero_rnf` | string, nullable | |
| `egapro_renseignee`, `est_achats_responsables`, `est_alim_confiance`, `est_association`, `est_avocat`, `est_bio`, `est_entrepreneur_individuel`, `est_entrepreneur_spectacle`, `est_ess`, `est_finess`, `est_organisme_formation`, `est_qualiopi`, `est_rge`, `est_siae`, `est_societe_mission`, `est_uai`, `est_patrimoine_vivant`, `bilan_ges_renseigne`, `est_administration` | boolean | |
| `liste_id_organisme_formation` | array, nullable | |
| `identifiant_association` | string (RNA), nullable | |
| `statut_entrepreneur_spectacle` | string, nullable | |
| `type_siae` | string, nullable | |
| `a_aide_minimis`, `a_aide_ademe` | boolean | Non documentées dans l'OpenAPI. |
| `est_service_public` | boolean, nullable | **Déprécié**, utiliser `est_administration`. |
| `est_l100_3` | boolean, nullable | **Déprécié**. |

### 6.7 Réponse minimale

Avec `minimal=true` seul, chaque `result` ne contient que 22 champs : `siren`, `nom_complet`, `nom_raison_sociale`, `sigle`, `nombre_etablissements`, `nombre_etablissements_ouverts`, `activite_principale`, `activite_principale_naf25`, `categorie_entreprise`, `caractere_employeur`, `annee_categorie_entreprise`, `date_creation`, `date_fermeture`, `date_mise_a_jour`, `date_mise_a_jour_insee`, `date_mise_a_jour_rne`, `etat_administratif`, `nature_juridique`, `section_activite_principale`, `tranche_effectif_salarie`, `annee_tranche_effectif_salarie`, `statut_diffusion`. Les champs secondaires (`siege`, `dirigeants`, `matching_etablissements`, `finances`, `complements`, `tva`, `score`) s'ajoutent via `include`. Sans `minimal`, le code inclut `SIEGE`, `FINANCES`, `TVA`, `COMPLEMENTS`, `DIRIGEANTS`, `MATCHING_ETABLISSEMENTS`, jamais `score`.

### 6.8 Exemple réel tronqué

`GET https://recherche-entreprises.api.gouv.fr/search?q=81280923400030`, HTTP 200, `content-type: application/json`. Version complète dans `docs/reference/recherche-entreprises.sample.json` (échantillon 2).

```json
{
  "results": [
    {
      "siren": "812809234",
      "nom_complet": "BOULANGERIE DU NIL",
      "nom_raison_sociale": "BOULANGERIE DU NIL",
      "sigle": null,
      "nombre_etablissements": 6,
      "nombre_etablissements_ouverts": 5,
      "siege": {
        "siret": "81280923400014",
        "adresse": "7 RUE DU NIL 75002 PARIS",
        "numero_voie": "7",
        "type_voie": "RUE",
        "libelle_voie": "DU NIL",
        "code_postal": "75002",
        "commune": "75102",
        "libelle_commune": "PARIS",
        "departement": "75",
        "region": "11",
        "epci": "200054781",
        "latitude": "48.867702377",
        "longitude": "2.3478165515",
        "coordonnees": "48.867702377,2.3478165515",
        "activite_principale": "70.10Z",
        "activite_principale_naf25": "70.10Y",
        "tranche_effectif_salarie": "12",
        "annee_tranche_effectif_salarie": "2023",
        "caractere_employeur": "O",
        "etat_administratif": "A",
        "est_siege": true,
        "statut_diffusion_etablissement": "O",
        "date_creation": "2015-07-02",
        "date_mise_a_jour_insee": "2025-12-06T04:08:31",
        "liste_idcc": ["0843"],
        "nom_commercial": null,
        "liste_enseignes": null,
        "...": "47 champs au total, voir docs/reference"
      },
      "activite_principale": "10.71C",
      "activite_principale_naf25": "10.71H",
      "categorie_entreprise": "PME",
      "caractere_employeur": null,
      "annee_categorie_entreprise": "2023",
      "date_creation": "2015-07-02",
      "date_fermeture": null,
      "date_mise_a_jour": "2026-09-08T10:15:13",
      "date_mise_a_jour_insee": "2025-12-06T04:08:31",
      "date_mise_a_jour_rne": "2026-08-25T16:36:54",
      "dirigeants": [
        {
          "nom": "DROUARD",
          "prenoms": "ALEXANDRE",
          "annee_de_naissance": "1983",
          "date_de_naissance": "1983-05",
          "qualite": "Gérant",
          "nationalite": null,
          "type_dirigeant": "personne physique"
        }
      ],
      "etat_administratif": "A",
      "nature_juridique": "5499",
      "section_activite_principale": "C",
      "tranche_effectif_salarie": "12",
      "annee_tranche_effectif_salarie": "2023",
      "statut_diffusion": "O",
      "matching_etablissements": [
        {
          "siret": "81280923400030",
          "adresse": "8 RUE PAUL BERT 75011 PARIS",
          "code_postal": "75011",
          "commune": "75111",
          "libelle_commune": "PARIS",
          "region": "11",
          "epci": "200054781",
          "latitude": "48.851471801",
          "longitude": "2.3846570761",
          "activite_principale": "10.71C",
          "activite_principale_naf25": "10.71H",
          "tranche_effectif_salarie": "NN",
          "annee_tranche_effectif_salarie": null,
          "caractere_employeur": "N",
          "etat_administratif": "A",
          "est_siege": false,
          "ancien_siege": false,
          "statut_diffusion_etablissement": "O",
          "date_creation": "2019-10-01",
          "nom_commercial": null,
          "liste_enseignes": null,
          "...": "30 champs au total, voir docs/reference"
        }
      ],
      "finances": { "2023": { "ca": 0, "resultat_net": 437133 } },
      "complements": {
        "est_association": false,
        "est_entrepreneur_individuel": false,
        "convention_collective_renseignee": true,
        "liste_idcc": ["0843"],
        "a_aide_minimis": false,
        "a_aide_ademe": false,
        "est_service_public": null,
        "est_l100_3": null,
        "...": "32 clés au total, voir docs/reference"
      },
      "tva": ["FR04812809234"]
    }
  ],
  "total_results": 1,
  "page": 1,
  "per_page": 10,
  "total_pages": 1
}
```

Lecture pour Candidatly : l'établissement recruteur est `matching_etablissements[0]` (SIRET demandé, boulangerie du 75011, activité `10.71C`), l'unité légale est `results[0]`, et `siege` est un autre établissement (siège au 75002, activité `70.10Z`).

Exemple de réponse minimale avec score (`GET /search?q=Capgemini&code_postal=92130&per_page=2&minimal=true&include=score`, tronqué) :

```json
{
  "results": [
    {
      "siren": "479766842",
      "nom_complet": "CAPGEMINI TECHNOLOGY SERVICES",
      "nom_raison_sociale": "CAPGEMINI TECHNOLOGY SERVICES",
      "sigle": null,
      "nombre_etablissements": 112,
      "nombre_etablissements_ouverts": 59,
      "activite_principale": "62.02A",
      "activite_principale_naf25": "62.20G",
      "categorie_entreprise": "GE",
      "caractere_employeur": null,
      "annee_categorie_entreprise": "2023",
      "date_creation": "2004-11-16",
      "date_fermeture": null,
      "date_mise_a_jour": "2026-09-08T09:13:40",
      "date_mise_a_jour_insee": "2026-07-14T13:14:37",
      "date_mise_a_jour_rne": "2026-08-28T13:07:10",
      "etat_administratif": "A",
      "nature_juridique": "5710",
      "section_activite_principale": "J",
      "tranche_effectif_salarie": "53",
      "annee_tranche_effectif_salarie": "2023",
      "statut_diffusion": "O",
      "score": 1944.792
    },
    { "siren": "479766800", "nom_complet": "CAPGEMINI CONSULTING ()", "score": 1510.7189, "...": "22 champs de base" }
  ],
  "total_results": 2,
  "page": 1,
  "per_page": 2,
  "total_pages": 1
}
```

## 7. Tables de codes

### 7.1 `tranche_effectif_salarie` (unité légale et établissement)

Source : `app/labels/tranches-effectifs.json` du dépôt (fichier lié depuis l'OpenAPI), copié dans `docs/reference/recherche-entreprises.tranches-effectifs.json`. Ce sont les 16 seules valeurs acceptées par le filtre.

| Code | Libellé officiel |
|---|---|
| `NN` | Unité non employeuse (pas de salarié au cours de l'année de référence et pas d'effectif au 31/12) |
| `00` | 0 salarié (n'ayant pas d'effectif au 31/12 mais ayant employé des salariés au cours de l'année de référence) |
| `01` | 1 ou 2 salariés |
| `02` | 3 à 5 salariés |
| `03` | 6 à 9 salariés |
| `11` | 10 à 19 salariés |
| `12` | 20 à 49 salariés |
| `21` | 50 à 99 salariés |
| `22` | 100 à 199 salariés |
| `31` | 200 à 249 salariés |
| `32` | 250 à 499 salariés |
| `41` | 500 à 999 salariés |
| `42` | 1 000 à 1 999 salariés |
| `51` | 2 000 à 4 999 salariés |
| `52` | 5 000 à 9 999 salariés |
| `53` | 10 000 salariés et plus |

### 7.2 Autres valeurs codées

| Champ | Valeurs |
|---|---|
| `etat_administratif` (unité légale) | `A` Active, `C` Cessée |
| `etat_administratif` (établissement) | `A` Actif, `F` Fermé |
| `statut_diffusion`, `statut_diffusion_etablissement` | `O` diffusible, `P` diffusion partielle |
| `categorie_entreprise` | `PME`, `ETI`, `GE` (ou `null`) |
| `caractere_employeur` | `O`, `N` (ou `null`) |
| `section_activite_principale` | 21 lettres `A` à `U` (NAF rév. 2 ; la NAF 2025 en compte 22, `A` à `V`, voir section 13) |
| `nature_juridique` | 260 codes de catégorie juridique INSEE (table `app/labels/natures-juridiques.json` du dépôt, ex. `1000` Entrepreneur individuel) ; pas de libellé dans l'API |
| `type_dirigeant` | `personne physique`, `personne morale` |

Le dépôt fournit aussi `app/labels/sections-codes-NAF.json` (21 sections) et `app/labels/natures-entreprises.json` (15 entrées).

## 8. Libellés NAF : absents de l'API, où les prendre

- L'API ne renvoie aucun libellé d'activité : uniquement `activite_principale` (NAF rév. 2, format `NN.NNL`, ex. `62.02A`), `activite_principale_naf25` (NAF 2025, ex. `62.20G`) et `section_activite_principale`. La colonne `companies.naf_label` du brief doit donc être résolue localement.
- **NAF rév. 2 (732 sous-classes)** : le service embarque lui-même ses libellés dans `app/labels/codes-NAF.json` (732 entrées, ex. `62.02A` « Conseil en systèmes et logiciels informatiques », `10.71C` « Boulangerie et boulangerie-pâtisserie », `70.10Z` « Activités des sièges sociaux »). Copie : `docs/reference/naf-rev2-codes-labels.json`. Ce fichier **ne contient pas** les codes NAF 2025 (`10.71H`, `70.10Y` absents).
- Contre-vérification du nombre de sous-classes : le jeu data.gouv « Nomenclature d'activités française - NAF rév. 2 (code APE) » (Région Île-de-France, Licence Ouverte 2.0, daté du 2017-07-28) fournit un JSON de 1 707 enregistrements (`code_naf`, `intitule_naf`, `intitule_naf_40`, `intitule_naf_65`) dont exactement 732 codes de sous-classe. Attention : ce JSON encode les codes **sans point** (`6202A`) alors que l'API renvoie `62.02A` ; normaliser avant toute jointure. Les 975 autres enregistrements sont les divisions, groupes et classes avec zéros initiaux supprimés (ex. `14`, `982`, `9312`).
- Source INSEE NAF rév. 2 : `https://www.insee.fr/fr/information/2120875`, fichier de libellés courts `/fr/statistiques/fichier/2120875/int_courts_naf_rev_2.xls` (311 808 octets, `application/vnd.ms-excel`), plus un fichier XLS / DBF par niveau et un fichier « cinq niveaux emboîtés ». Ce XLS n'a pas pu être parsé pendant la recherche ; le comptage de 732 repose sur le dépôt officiel et le JSON data.gouv.
- **NAF 2025 (747 sous-classes)** : page INSEE `https://www.insee.fr/fr/information/8617910` (mise à jour 05/02/2026), fichiers « Structure NAF 2025 Maj 2024-10-04.xlsx » (88 187 octets, 6 onglets : NAF 2025, Sections, Divisions, Groupes, Classes, Sous-classes), un PDF, « NAF2025 - Notes - Edition 2025.pdf » et « Correspondances_NAFrev2-NAF2025.xlsx » (table de correspondance éditée en janvier 2026). Comptage confirmé par deux lectures indépendantes du XLSX : 22 sections (`A` à `V`), 87 divisions, 287 groupes, 651 classes, 747 sous-classes (ex. `01.11Y`, `10.71H`, dernière `99.00Y`).
- Recommandation : stocker `naf_code` (rév. 2) **et** un `naf25_code`, embarquer les deux tables de libellés (732 + 747, à extraire du XLSX INSEE pour la NAF 2025) et résoudre le libellé côté serveur. Calendrier de bascule en section 13.

## 9. Quotas, limitation de débit, en-têtes

### 9.1 Limites annoncées

- OpenAPI, section « Limite des requêtes » : « au maximum 7 requêtes par seconde » par adresse IP, et une limite de 30 requêtes par seconde par ASN ; « il est donc probable de faire face à cette limite sur les cloud publics ». Cette valeur est « une limite maximale et ne constitue pas un débit garanti ». En cas d'usage excessif, l'accès peut être temporairement restreint, priorité étant donnée aux systèmes internes et aux services publics. Dépassement : HTTP 429 avec un en-tête `Retry-After`.
- Fiche data.gouv : « 7 appels / seconde. L'administration s'autorise à baisser cette limite en cas de surcharge des serveurs ».
- Incohérence connue : la page du site (source `src/routes/_header-default/donnees.api-entreprises.tsx` du dépôt `site`) affiche « 100% ouverte, 400 appels/min/IP » pour cette API. Retenir la valeur la plus stricte des deux (7 requêtes par seconde) pour le dimensionnement, et surtout la limite partagée par ASN.

### 9.2 Comportement réel observé

Deux couches de limitation coexistent. Sur une rafale de 30 requêtes parallèles : 13 réponses 200, 15 réponses 429 émises par nginx et 2 réponses 429 émises par l'application.

| Couche | Statut | `content-type` | Corps | `Retry-After` |
|---|---|---|---|---|
| nginx | 429 | `text/html` | `<html><head><title>429 Too Many Requests</title></head><body><center><h1>429 Too Many Requests</h1></center><hr><center>nginx</center></body></html>` | **Absent** (aucun `X-RateLimit-*` non plus) |
| Application (FastAPI) | 429 | `application/octet-stream` | `Too Many Requests.` | `retry-after: 3` |

Conséquences pour le client :

- Ne jamais supposer un corps JSON sur une 429 ; ne pas parser le corps, se baser sur le statut.
- Si `Retry-After` est présent, l'honorer ; sinon, backoff exponentiel autonome (démarrer à 1 s).
- Vercel partage des ASN publics : la limite de 30 requêtes par seconde par ASN peut être consommée par d'autres clients hébergés au même endroit. ⚠️ Non vérifié : l'impact réel depuis nos environnements de production n'a pas été mesuré.

### 9.3 En-têtes de réponse (200)

`server: nginx`, `content-type: application/json`, `vary: Accept-Encoding`, `annuaire-entreprises-instance-number: 02`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, `strict-transport-security: max-age=31536000`, `x-xss-protection: 1; mode=block`, `access-control-allow-headers: Content-Type`, `access-control-allow-origin: *`. **Aucun en-tête de cache** (`Cache-Control`, `ETag`, `Last-Modified`) ni d'en-tête de quota.

## 10. Codes d'erreur

| Statut | Corps | Cas |
|---|---|---|
| 200 | `payload` avec `results: []` | Aucun résultat, y compris SIRET ou SIREN inconnu (`q=00000000000000`). Ne jamais attendre un 404 pour « entreprise introuvable ». |
| 400 | `{"erreur": "Veuillez indiquer au moins un paramètre de recherche."}` | `/search` sans aucun paramètre |
| 400 | `{"erreur": "3 caractères minimum pour les termes de la requête (ou utilisez au moins un filtre)"}` | `q` trop court sans filtre |
| 400 | « Veuillez indiquer un paramètre `page` entre `1` et `1000`, par défaut `1`. » | `page` hors bornes |
| 400 | « Veuillez indiquer un paramètre `per_page` entre `1` et `25`, par défaut `10`. » | `per_page` hors bornes |
| 400 | « Veuillez indiquer un paramètre `matching_size` entre `1` et `100`, par défaut `10`. » | `limite_matching_etablissements` hors bornes (nom interne dans le message) |
| 400 | « Le nombre total de résultats est restreint à 10 000. Pour garantir cela, le produit du numéro de page (par défaut, page = 1) et du nombre de résultats par page (par défaut, per_page = 10), c'est-à-dire `page * per_page`, ne doit pas excéder 10 000. » | Pagination au-delà de 10 000 |
| 400 | « Au moins une valeur du paramètre code_postal est non valide. » | `code_postal` invalide (s'applique même en mode SIRET direct) |
| 400 | « Le paramètre etat_administratif doit prendre une des valeurs suivantes ['A', 'C']. » | `etat_administratif` invalide |
| 400 | Message listant `['NN', '00', '01', '02', '03', '11', '12', '21', '22', '31', '32', '41', '42', '51', '52', '53']` | `tranche_effectif_salarie` invalide |
| 400 | « Veuillez indiquer si vous souhaitez une réponse minimale avec le filtre `minimal=True`` avant de préciser les champs à inclure. » | `include` sans `minimal=true` |
| 400 | « Au moins un champ à inclure est non valide. Les champs valides : ['complements', 'dirigeants', 'finances', 'score', 'siege', 'matching_etablissements', 'tva']. » | Valeur d'`include` inconnue |
| 400 | « Les paramètres 'lat' et 'long' sont obligatoires pour une recherche géographique. » | `/near_point` sans `lat` ou `long` |
| 400 | « Veuillez indiquer un paramètre `lat` entre `-90` et `90`, par défaut `None`. » / « ... `lon` entre `-180` et `180` ... » | `/near_point` hors bornes |
| 400 | « Veuillez indiquer un paramètre radius entre 0.001 et 50, par défaut 5. » | `/near_point` rayon hors bornes |
| 404 | `{"erreur":"Ressource non trouvée."}` | Chemin inconnu |
| 405 | En-tête `allow: HEAD, GET` | `OPTIONS` |
| 429 | HTML nginx ou texte applicatif (section 9.2) | Quota dépassé |

Toutes les erreurs 400 et 404 sont des objets JSON `{"erreur": string}` (schéma OpenAPI). Les messages exacts contiennent des accents typographiques et des backticks : dans les tests, ne pas comparer ces chaînes strictement, tester le statut et éventuellement une sous-chaîne. Aucune réponse 5xx n'a été observée pendant la recherche, mais le client doit les traiter comme réessayables.

## 11. Fraîcheur des données, cache et rétention

### 11.1 Fraîcheur

- README du dépôt `search-api` : mises à jour quotidiennes par import de l'index Elasticsearch construit par l'infrastructure data (`search-infra`). README de `search-infra` : toutes les sources (Base Sirene stock et API INSEE, Base RNE stock et API INPI, ratios financiers, élus, conventions collectives, Egapro, ESS, FINESS, RGE, spectacles, annuaire de l'éducation, bio, organismes de formation, inclusion) sont récupérées par des DAG Airflow quotidiens, puis ETL SQLite, indexation Elasticsearch et distribution d'un snapshot aux instances.
- FAQ du site (`frequence-mise-a-jour-donnees.yml`) : « Les données du moteur de recherche sont mises à jour au plus tard tous les deux jours. »
- Jeu data.gouv « Données des entreprises utilisées dans l'Annuaire des Entreprises » : « mises à jour quotidiennement », dernière mise à jour le 8 septembre 2026 (une note indique qu'en mai 2026 les champs latitude / longitude ont été retirés de ce jeu export ; l'API, elle, les renvoie toujours).
- Observé : `date_mise_a_jour: 2026-09-08T10:15:13` dans nos échantillons du 9 septembre, et `GET /sources/last_modified` donne `sirene` 2026-09-08. Certaines sources sont bien plus anciennes (`bilan_financier` 2026-06-01, `ess_france` 2023-11-20).
- ⚠️ Non vérifié : le délai de propagation d'une modification INSEE ou INPI jusqu'à l'index n'est pas chiffré ; « quotidien » (README) et « au plus tard tous les deux jours » (FAQ) coexistent.

### 11.2 Sources par famille de données

| Donnée | Source amont |
|---|---|
| Identification (dénomination, adresse, NAF, forme juridique, effectifs, dates) | INSEE (base SIRENE, API INSEE) |
| Dirigeants | INPI (RNE, FTP INPI) |
| Bilans financiers (`finances`) | INPI / Signaux Faibles |
| TVA | DGFiP |
| Géolocalisation | Base SIRENE géocodée par l'INSEE (sauf créations récentes) |

### 11.3 Cache et rétention côté Candidatly

- L'API n'envoie aucun en-tête de cache et les documents consultés (OpenAPI, fiche data.gouv, FAQ, politique de confidentialité) ne formulent **aucune contrainte de durée de conservation ni d'interdiction de cache** pour les réutilisateurs. Le seul cadre est la Licence Ouverte 2.0 (section 12).
- Proposition : TTL de 30 jours sur `companies` (re-enrichissement à la prochaine offre rencontrée après expiration), avec conservation de `date_mise_a_jour` et `date_mise_a_jour_rne` dans la ligne pour tracer la fraîcheur de la source.
- Pour les dirigeants (données personnelles soumises à un droit d'opposition, section 12), le rafraîchissement périodique est aussi le mécanisme qui propage les suppressions demandées à la DINUM ; ne pas allonger le TTL au-delà de 30 jours pour ce champ.

## 12. Licence, conditions d'utilisation, attribution, RGPD

### 12.1 Licence des données et du code

- Données : **Licence Ouverte / Open Licence version 2.0**, affichée sur la fiche data.gouv de l'API (rendu HTML, lien vers `Licence-Ouverte-v2.0.pdf`) et sur le jeu de données « Données des entreprises utilisées dans l'Annuaire des Entreprises ». Le champ `license` de l'API JSON de data.gouv est `null`.
- Code du service : MIT (`info.license` de l'OpenAPI et dépôt GitHub).
- FAQ « Comment puis-je utiliser ces données dans mon site internet ? » (`reutiliser-les-donnees.yml`) : les données de la partie publique du site sont en open data ; les données protégées (verrou) sont réservées aux agents publics authentifiés.
- **Il n'existe pas de CGU propres à l'API.** Le lien « Modalités d'utilisation » de data.gouv pointe vers les CGU générales de la plateforme (`/pages/legal/cgu`). Le dépôt du site ne contient aucune page de CGU spécifique (`mentions-legales.tsx` ne mentionne que l'éditeur DINUM, le directeur de publication et l'hébergeur OVH Roubaix).
- Attribution : la Licence Ouverte 2.0 attend la mention de la source. Prévoir dans la fiche entreprise et dans la politique de confidentialité une mention de type « Source : Annuaire des Entreprises (DINUM), API Recherche d'entreprises, données INSEE et INPI, Licence Ouverte 2.0 ». ⚠️ Non vérifié : la formulation exacte à retenir n'est pas prescrite par les documents consultés ; à valider avec un juriste avant la bêta.

### 12.2 Exclusions et diffusion partielle

- Ne sont pas accessibles dans l'API (OpenAPI et fiche data.gouv) : les entreprises non-diffusibles, les entreprises qui se sont vu refuser leur immatriculation au RCS, les prédécesseurs et successeurs d'un établissement. L'API « ne permet pas d'accéder aux données complètes de la base Sirene » (voir `https://api.gouv.fr/guides/quelle-api-sirene`).
- Depuis le décret n° 2022-1014 du 19 juillet 2022 (art. A123-96 du code de commerce, FAQ `entreprise-non-diffusible.yml`), le statut « non-diffusible » est devenu une **diffusion partielle** : pour une personne physique, identité (nom, prénoms), adresse dans la commune et géolocalisation masquées ; pour une personne morale, seuls les éléments de géolocalisation / adresse sont masqués (sauf la commune). Activité principale, catégorie juridique, tranche d'effectifs et état administratif restent diffusés.
- Implémentation dans le code (`non_diffusible.py`), constante de masquage `"[NON-DIFFUSIBLE]"` : unité légale personne physique en `P` : `nom_complet`, `nom_raison_sociale`, `sigle` masqués ; unité légale personne morale en `P` : seul `sigle` masqué ; établissements en `P` : `adresse`, `cedex`, `code_postal`, `complement_adresse`, `coordonnees`, `distribution_speciale`, `indice_repetition`, `longitude`, `latitude`, `libelle_cedex`, `libelle_voie`, `numero_voie`, `dernier_numero_voie`, `type_voie` masqués (plus `nom_commercial` et `liste_enseignes` pour une personne physique) ; dirigeants personnes physiques d'une unité légale en `P` : `nom`, `prenoms`, `annee_de_naissance`, `date_de_naissance`, `nationalite` masqués. La recherche textuelle filtre en amont les unités légales `statut_diffusion_unite_legale = "O"` ou personnes morales.
- Règle Candidatly : tester `statut_diffusion` et `statut_diffusion_etablissement`, et rejeter toute valeur littérale `[NON-DIFFUSIBLE]` avant affichage ou envoi au LLM.

### 12.3 Données personnelles des dirigeants

- Politique de confidentialité (source `vie-privee.tsx` du dépôt du site, page en ligne inaccessible) : responsable de traitement DINUM ; données traitées « Nom, prénom » des représentants et des bénéficiaires effectifs, collectées via INSEE, INPI et DILA ; base légale : mission d'intérêt public (art. 6-1 e RGPD), décret n° 2023-304 du 22 avril 2023 modifiant le décret n° 2019-1088 ; conservation « jusqu'à 10 ans suivant la cessation de l'activité » ; droits d'information, d'accès, de rectification, d'opposition et de limitation, exercés via le formulaire de contact, par courrier (DINUM, 20 avenue de Ségur, 75007 Paris) ou `dpd@pm.gouv.fr`. Parmi les destinataires : « Les utilisateurs de l'API uniquement pour les données relatives aux représentants et bénéficiaires effectifs ».
- FAQ `supprimer-donnees-personnelles-entreprise.yml` : un dirigeant peut s'opposer à la publication de ses nom et prénom sur un site internet et demander leur retrait (formulaire `/formulaire/supprimer-donnees-personnelles-entreprise`).
- Aucune obligation contractuelle spécifique aux réutilisateurs n'a été trouvée dans les documents consultés ; seuls la Licence Ouverte 2.0 et le droit d'opposition RGPD s'appliquent. ⚠️ Non vérifié : à confirmer avec un juriste avant la bêta.
- Règles Candidatly (minimisation) : ne conserver et n'afficher que `nom`, `prenoms`, `qualite` des dirigeants personnes physiques opérationnels ; **ne jamais stocker ni afficher `date_de_naissance`, `annee_de_naissance` ni `nationalite`** ; exclure les commissaires aux comptes ; rafraîchir régulièrement (section 11.3) ; documenter la source INPI / RNE dans notre politique de confidentialité ; prévoir un mécanisme de suppression sur demande.

## 13. État du service, dépréciations et calendrier

| Élément | État | Date |
|---|---|---|
| API `/search`, `/near_point` | En production, OpenAPI `1.0.0`, disponibilité affichée 100 % sur data.gouv | Vérifié le 9 septembre 2026 |
| Versionnement | Aucun : pas de release, de tag ni de `CHANGELOG` ; le chemin ne porte pas de version. Suivre l'historique des commits du dépôt. | Dernier push `2026-09-09T09:33:15Z` |
| `activite_principale_naf25` | **Champ temporaire, supprimé à compter du 1er janvier 2027** (OpenAPI) | 2027-01-01 |
| NAF 2025 | Décret n° 2025-736 du 31 juillet 2025 portant approbation de la NAF 2025. « À compter du 1er janvier 2027, la NAF 2025 sera la nouvelle nomenclature de référence pour l'attribution des codes APE » ; « Pendant toute l'année 2026, le site sirene.gouv.fr donne à voir aux entreprises le (futur) code APE en NAF 2025 » ; entrée dans les répertoires statistiques dès 2026, intégration progressive jusque fin 2029 (INSEE, page 8181066 mise à jour le 12/02/2026). | 2027-01-01 |
| Bascule d'`activite_principale` | ⚠️ Non vérifié : rien n'écrit explicitement qu'`activite_principale` passera en NAF 2025 quand `activite_principale_naf25` disparaîtra ; à surveiller dans la spécification vers décembre 2026. | À surveiller |
| Sections NAF | NAF 2025 : 22 sections (`A` à `V`). `sections-codes-NAF.json` du dépôt et le filtre `section_activite_principale` n'en connaissent que 21 (`A` à `U`) ; la section `V` (organisations extraterritoriales) est à prévoir pour 2027. | 2027 |
| `siege.geo_id`, `siege.geo_adresse`, `etablissement.geo_id` | Obsolètes, toujours vides | |
| `complements.est_service_public`, `complements.est_l100_3` | Dépréciés (`deprecated` dans l'OpenAPI), utiliser `est_administration` | |
| `complements.a_aide_minimis`, `complements.a_aide_ademe` | Renvoyés mais non documentés | |
| `/fondation` | Route non documentée, ajoutée le 2026-07-28 | |
| Syntaxe `q=siren:`, filtre `code_naf` | Présents dans le README mais non fonctionnels (README obsolète) | |
| `nationalite` (dirigeants) | ⚠️ Non vérifié : `null` dans tous nos échantillons, on ignore si le champ est jamais renseigné. Ne pas en dépendre. | |

## 14. Pièges et comportements observés

1. **Pas de tolérance aux fautes de frappe.** `q=Capgemni` renvoie 0 résultat, avec ou sans filtre. Le fichier de requêtes Elasticsearch (`app/elastic/queries/text.py`) ne contient aucune clause `fuzziness` ; il utilise `match_phrase` et `match` avec `operator: AND`. Prévoir des variantes du nom de l'offre (sans forme juridique, enseigne seule).
2. **Champs interrogés par la recherche textuelle** : `unite_legale.etablissements.nom_complet` avec boost `^15` (clause nested, `min_score: 4`), `enseigne_1..3`, `nom_commercial`, `sigle`, `adresse`, `commune` des établissements, un champ concaténé enseigne + adresse + siren + siret ; côté unité légale `nom_raison_sociale`, `sigle`, `nom`, `prenom` (en `cross_fields` / `AND`), `liste_dirigeants`, `liste_elus` ; le tout pondéré par `function_score` et `facteur_taille_entreprise`. Un nom d'enseigne trouve donc l'unité légale même si la raison sociale diffère : `q=Leroy Merlin&code_postal=75012` renvoie LEROY MERLIN FRANCE via `liste_enseignes: ["LEROY MERLIN"]` (score 3517.918) et un faux positif ECOMAISON (score 38.637012).
3. **Insensible aux accents et à la casse, mais le score ne l'est pas** : `societe generale` et `société générale` donnent les mêmes 8 507 résultats et le même premier résultat (SOCIETE GENERALE, SIREN 552120222) avec des scores de 29 547.037 et 3 287.1565. Le score n'est comparable qu'entre résultats d'une même réponse ; ne jamais utiliser de seuil absolu.
4. **Tri par défaut pondéré par la taille**, `sort_by_size=true` trie par nombre d'établissements (vérifié : `q=boulangerie&code_postal=75011&etat_administratif=A&sort_by_size=true` renvoie 30 résultats). ⚠️ Non vérifié : les noms de fonctions `sort_by_nombre_etablissement_query` (défaut) et `sort_by_size_text_query` proviennent d'une lecture du code, sans test de leur effet précis. Une grande entreprise homonyme peut passer devant la petite structure locale visée : filtrer par `code_postal` et vérifier `matching_etablissements`.
5. **`matching_etablissements` n'est pas la liste des établissements** : c'est la liste de ceux qui ont matché (au plus 100 via `limite_matching_etablissements`, paginable via `page_etablissements`). En mode SIRET direct, il contient exactement l'établissement demandé ; en mode SIREN direct, il est vide ; en recherche nom + `code_postal`, il contient les établissements du code postal demandé.
6. **`siege` n'est pas l'établissement recruteur.** Pour une offre localisée, l'adresse pertinente est celle de `matching_etablissements[0]`, pas celle du siège (exemple de la section 6.8 : siège 75002, boulangerie 75011). Le brief demande « l'adresse du siège » : stocker les deux si nécessaire (voir section 15).
7. **Introuvable = 200 vide**, jamais 404 (section 10).
8. **Recherche directe : filtres ignorés silencieusement, mais validés.** Ne pas combiner SIRET et `code_postal` ; si le SIRET est fourni, l'envoyer seul.
9. **`nom_complet` contient des parenthèses**, parfois vides (`CAPGEMINI CONSULTING ()`) : utiliser `nom_raison_sociale` pour l'affichage et nettoyer `nom_complet` avant toute comparaison.
10. **Plafonds** : 10 000 résultats, `page` 1 à 1000, `per_page` 1 à 25, `page * per_page` 10 000 max, `total_results` plafonné à 10 000 (même sur `/near_point`, ex. `total_pages: 5000` avec `per_page=2`).
11. **429 sans JSON ni `Retry-After` garanti** (section 9.2).
12. **Aucun site web, email ou téléphone** dans l'API : `companies.website` vient de l'offre (`offers.company_website`).
13. **`finances.ca` peut valoir `0`** (ex. `{"2023":{"ca":0,"resultat_net":437133}}`). ⚠️ Non vérifié : la sémantique de `0` (chiffre d'affaires réellement nul ou non renseigné) n'est pas documentée. Ne pas afficher ni transmettre `finances` au LLM au MVP.
14. **Champs qui apparaissent et disparaissent** (`score`, `activite_principale_naf25` en 2027, clés non documentées de `complements`) : ne pas utiliser `strict()` dans les schémas Zod.
15. **Schémas internes non exposés** : le modèle interne (`unite_legale.py`) contient `successions`, `immatriculation`, `bodacc`, `etablissements`. ⚠️ Non vérifié : les prédécesseurs / successeurs ne sont pas exposés publiquement d'après data.gouv ; non testé.
16. **Messages d'erreur** avec backticks et nom de paramètre interne (`matching_size`, `lon`) : ne pas les réutiliser tels quels dans l'UI, traduire en message Candidatly.

## 15. Mapping vers notre schéma

### 15.1 Stratégie d'appel (`lib/enrichment/recherche-entreprises.ts`)

| Fonction | Requête | Quand |
|---|---|---|
| `findBySiret(siret)` | `GET /search?q=<siret, chiffres uniquement>&minimal=true&include=siege,dirigeants,matching_etablissements,complements` | `offers.company_siret` renseigné (14 chiffres après normalisation) |
| `searchByNameAndPostalCode(name, postalCode)` | `GET /search?q=<nom>&code_postal=<cp>&per_page=5&minimal=true&include=siege,dirigeants,matching_etablissements,score` | Sinon, à partir d'`offers.company_name` et du code postal dérivé de `offers.location_label` / `offers.insee_code` |

Validation en entrée : `q` d'au moins 3 caractères ; `code_postal` conforme à la regex de la section 3.2 ; encodage par `URLSearchParams` ; `AbortSignal.timeout(8000)` ; `User-Agent` identifiable. Réponse validée par Zod (`safeParse`), échec converti en `ExternalApiError` avec le chemin Zod dans les logs.

Schéma Zod : `payload` + `result` avec tous les champs `nullable()` sauf `siren` et `nom_complet` ; `dirigeants` en union discriminée sur `type_dirigeant` ; `finances` en `record(string, { ca, resultat_net })` ; `score` optionnel ; `complements` en `passthrough()` ; jamais `strict()`.

### 15.2 Table `companies`

| Colonne `companies` | Champ API | Règle |
|---|---|---|
| `siret` | `matching_etablissements[0].siret` | En mode SIRET direct, c'est le SIRET demandé. En mode nom + code postal, prendre l'établissement matché dont `code_postal` correspond à l'offre ; à défaut `siege.siret`. |
| `siren` | `results[0].siren` | |
| `legal_name` | `results[0].nom_raison_sociale` | Repli sur `nom_complet` nettoyé des parenthèses vides. |
| `brand_name` | `matching_etablissements[0].nom_commercial`, sinon `matching_etablissements[0].liste_enseignes[0]`, sinon `siege.nom_commercial` / `siege.liste_enseignes[0]`, sinon `results[0].sigle` | `null` si rien. |
| `naf_code` | `matching_etablissements[0].activite_principale` (activité réelle du lieu de travail), repli sur `results[0].activite_principale` | Format `NN.NNL`. Stocker aussi `activite_principale_naf25` dans une colonne `naf25_code` (à ajouter au schéma, voir section 16) en prévision de 2027. |
| `naf_label` | Aucun (absent de l'API) | Résolu localement depuis `docs/reference/naf-rev2-codes-labels.json` (732 codes) ; `null` si code inconnu. |
| `headcount_range` | `results[0].tranche_effectif_salarie` + `annee_tranche_effectif_salarie` | Libellé de la table de la section 7.1, préférer la tranche de l'unité légale (celle de l'établissement recruteur est souvent `NN`). Suggestion de format : « 20 à 49 salariés (2023) ». |
| `address` | `siege.adresse` | Le brief demande l'adresse du siège. L'adresse de l'établissement recruteur (`matching_etablissements[0].adresse`) est plus utile pour l'étudiant : la conserver dans `raw` ou dans une colonne supplémentaire `establishment_address` (section 16). |
| `postal_code` | `siege.code_postal` | Même remarque ; `matching_etablissements[0].code_postal` pour l'établissement. |
| `city` | `siege.libelle_commune` | Même remarque ; `matching_etablissements[0].libelle_commune` pour l'établissement. Valeurs en majuscules (`PARIS`, `PARIS 15`). |
| `website` | Aucun | Vient d'`offers.company_website`. |
| `executives` (jsonb) | `results[0].dirigeants` filtrés | Garder uniquement `type_dirigeant = "personne physique"`, `qualite` ne contenant pas « Commissaire aux comptes », et pour chacun **seulement** `{ nom, prenoms, qualite }`. Jamais `date_de_naissance`, `annee_de_naissance`, `nationalite`. Tableau vide si aucun. |
| `summary`, `summary_generated_at` | Aucun | Sortie du LLM (§6.2 du brief). |
| Colonnes à ajouter (proposition) | `date_creation` (unité légale), `naf25_code`, `source_updated_at` (`date_mise_a_jour`), `source_rne_updated_at` (`date_mise_a_jour_rne`), `confidence` (score maison, section 15.4), `raw` jsonb (réponse tronquée) | Le brief (§3.2) demande explicitement la date de création, absente de la liste de colonnes du §4 : voir section 16. |

Rejet systématique : `statut_diffusion = "P"`, `statut_diffusion_etablissement = "P"` sur l'établissement retenu, ou toute valeur `[NON-DIFFUSIBLE]` dans les champs mappés. Ignorer les unités légales `etat_administratif = "C"` et les établissements `etat_administratif = "F"` (une offre d'alternance publiée par une structure cessée est un signal d'erreur de matching).

### 15.3 Table `offers` (entrées de l'enrichissement)

| Colonne `offers` | Rôle |
|---|---|
| `company_siret` | Clé de recherche directe (`q=<siret>`), après suppression des espaces et tirets. |
| `company_name` | Terme `q` du repli nom + code postal ; nettoyer la forme juridique (SAS, SARL, SA, EURL) pour la comparaison. |
| `location_label`, `insee_code`, `lat`, `lng` | Le code postal n'est pas dans le schéma `offers` : le dériver du `location_label` ou du géocodage (`docs/API_ADRESSE.md`) avant l'appel. `insee_code` peut aussi servir au filtre `code_commune`. |
| `company_website` | Alimente `companies.website` (l'API ne fournit pas de site). |

### 15.4 Score de confiance (exigé par le brief §3.2)

Le `score` de l'API est inutilisable comme mesure absolue (section 14, point 3). Score maison proposé, entre 0 et 1, stocké dans `companies.confidence` :

- `1.0` si recherche directe par SIRET avec exactement un résultat.
- Sinon : similarité entre le nom de l'offre normalisé (majuscules, sans accents ni ponctuation, sans forme juridique) et `nom_raison_sociale`, `nom_complet`, `liste_enseignes`, `nom_commercial` ; bonus si `matching_etablissements` contient le code postal demandé ; bonus si `total_results = 1` ; malus si le `score` API du second résultat est proche de celui du premier (comparaison relative au sein de la même réponse, seul usage légitime du champ).
- Seuil d'affichage à calibrer sur les fixtures ; proposition initiale 0.8. En dessous : ne pas créer la fiche (`companies`) et l'indiquer dans l'UI, conformément au brief.

### 15.5 Entrées du résumé entreprise (brief §6.2)

Pour `size_and_context` (« taille, localisation, âge ») : `headcount_range`, `city` (établissement recruteur de préférence), `date_creation` de l'unité légale, `categorie_entreprise`. Pour `what_they_do` : `naf_label` (résolu localement) et `brand_name`. Ne pas transmettre `finances`, `dirigeants`, ni `complements` bruts au LLM ; la source à citer dans `sources` est l'URL de la requête `/search` effectuée.

### 15.6 Débit, retry, idempotence (job `enrich-company`)

- Débit global limité côté serveur à 2 requêtes par seconde vers cette API (marge sous les 7 par IP et les 30 par ASN partagés).
- Retry sur 429 et 5xx avec backoff exponentiel (`Retry-After` honoré si présent ; sinon 1 s, 2 s, 4 s ; 3 essais max via la configuration globale `maxAttempts: 3`). Les 400 sont des erreurs non rejouables (`AbortTaskRunError`).
- Idempotence : `idempotencyKey` = `enrich-company:<siret>` ou `enrich-company:<nom normalisé>:<code postal>` ; upsert sur `companies.siret`.
- Fixtures : `docs/reference/recherche-entreprises.sample.json` couvre SIRET, SIREN, nom + code postal, `minimal` + `score`, `/near_point`, 400, 404, 429 et le cas 200 vide. Aucun test ne doit appeler l'API réelle.

## 16. Points restant à vérifier

1. Impact réel de la limite de 30 requêtes par seconde par ASN depuis Vercel (ASN partagés) : non mesuré ; à observer en production avec des métriques sur les 429.
2. Comportement d'`activite_principale` au 1er janvier 2027 (bascule en NAF 2025 quand `activite_principale_naf25` sera supprimé) : non écrit explicitement ; surveiller l'OpenAPI vers décembre 2026. Prévoir aussi la section `V`.
3. Sémantique de `finances.ca = 0` (nul ou non renseigné) : non documentée.
4. Champ `nationalite` des dirigeants : `null` dans tous les échantillons, on ignore s'il est jamais renseigné.
5. Prédécesseurs / successeurs (`successions` dans le modèle interne) : annoncés non exposés, non testé.
6. Paramètre `include_admin` (`ETABLISSEMENTS`, `IMMATRICULATION`, `BODACC`, `ADMIN`) : présent dans le code, absent de l'OpenAPI, non testé, probablement réservé aux agents.
7. Tirets dans `q` en mode SIRET direct : le code ne les retire pas, non testé ; normaliser côté Candidatly.
8. Tri des `matching_etablissements` par `etat_administratif` et noms des fonctions de tri par défaut : lus dans le code, non testés.
9. Pages en ligne du site `annuaire-entreprises.data.gouv.fr` (vie privée, FAQ, sources, monitoring) : bloquées par Incapsula ; le contenu cité vient du dépôt GitHub et peut différer de la version publiée.
10. Fréquence exacte de rafraîchissement : « quotidien » (README) contre « au plus tard tous les deux jours » (FAQ) ; délai de propagation INSEE / INPI non chiffré. `GET /sources/last_modified` est le meilleur indicateur disponible.
11. Le fichier INSEE `int_courts_naf_rev_2.xls` n'a pas été parsé ; le comptage de 732 sous-classes repose sur le dépôt officiel et le JSON data.gouv de la Région Île-de-France.
12. Incohérence de quota entre la page du site (« 400 appels/min/IP ») et l'OpenAPI / data.gouv (7 requêtes par seconde) : non arbitrée par l'éditeur.
13. Obligations de réutilisation et formulation de l'attribution (Licence Ouverte 2.0) et cadre d'affichage des noms de dirigeants : aucune CGU propre à l'API ; à confirmer avec un juriste avant la bêta.
14. Schéma `companies` : le brief §3.2 demande la date de création et l'adresse du siège, mais la liste de colonnes du §4 n'a pas de `date_creation` ; la distinction siège / établissement recruteur, `naf25_code`, `confidence` et `raw` ne sont pas prévues non plus. À trancher en phase 1 (migration) et à tracer dans `docs/QUESTIONS.md`.

## 17. Sources

API et spécification :

- `https://recherche-entreprises.api.gouv.fr/openapi.json`
- `https://recherche-entreprises.api.gouv.fr/docs/`
- `https://recherche-entreprises.api.gouv.fr/search?q=81280923400030`
- `https://recherche-entreprises.api.gouv.fr/search?q=812809234`
- `https://recherche-entreprises.api.gouv.fr/search?q=812%20809%20234%2000030&minimal=true&include=matching_etablissements`
- `https://recherche-entreprises.api.gouv.fr/search?q=siren:130025265`
- `https://recherche-entreprises.api.gouv.fr/search?q=81280923400030&code_postal=13001&minimal=true&include=matching_etablissements`
- `https://recherche-entreprises.api.gouv.fr/search?q=81280923400030&code_postal=99999&minimal=true`
- `https://recherche-entreprises.api.gouv.fr/search?q=00000000000000`
- `https://recherche-entreprises.api.gouv.fr/search?q=Capgemini&code_postal=92130&per_page=3`
- `https://recherche-entreprises.api.gouv.fr/search?q=Capgemini&code_postal=92130&per_page=2&minimal=true&include=score`
- `https://recherche-entreprises.api.gouv.fr/search?q=Capgemini&per_page=1&minimal=true`
- `https://recherche-entreprises.api.gouv.fr/search?q=Capgemini&per_page=1`
- `https://recherche-entreprises.api.gouv.fr/search?q=Capgemini&per_page=26`
- `https://recherche-entreprises.api.gouv.fr/search?q=Capgemini&include=foo&minimal=true`
- `https://recherche-entreprises.api.gouv.fr/search?q=societe%20generale&per_page=2&minimal=true&include=score`
- `https://recherche-entreprises.api.gouv.fr/search?q=Leroy%20Merlin&code_postal=75012&per_page=3&minimal=true&include=score,matching_etablissements`
- `https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&per_page=25&minimal=true`
- `https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&per_page=25&page=401&minimal=true`
- `https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&page=0`
- `https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&limite_matching_etablissements=101`
- `https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&include=siege`
- `https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&tranche_effectif_salarie=99`
- `https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&code_postal=75011&etat_administratif=A&sort_by_size=true&per_page=2&minimal=true`
- `https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&per_page=1&minimal=true&page=12` (rafales de 20 et 30 requêtes parallèles)
- `https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&per_page=1&minimal=true`
- `https://recherche-entreprises.api.gouv.fr/search`
- `https://recherche-entreprises.api.gouv.fr/search?q=a`
- `https://recherche-entreprises.api.gouv.fr/search?q=a&page=1000`
- `https://recherche-entreprises.api.gouv.fr/near_point?lat=48.8566&long=2.3522&radius=0.5&per_page=2`
- `https://recherche-entreprises.api.gouv.fr/near_point?lat=48.85&long=2.35&radius=51`
- `https://recherche-entreprises.api.gouv.fr/near_point?lat=91&long=2.35`
- `https://recherche-entreprises.api.gouv.fr/near_point?lat=48.85&long=181`
- `https://recherche-entreprises.api.gouv.fr/near_point?lat=48.85&long=2.35&minimal=true&include=tva&per_page=1`
- `https://recherche-entreprises.api.gouv.fr/fondation?q=fondation%20de%20france&per_page=1`
- `https://recherche-entreprises.api.gouv.fr/sources/last_modified`
- `https://recherche-entreprises.api.gouv.fr/nope`

Catalogue, données et licence :

- `https://api.gouv.fr/les-api/api-recherche-entreprises`
- `https://www.data.gouv.fr/dataservices/672cf684c3488a0c533f7094`
- `https://www.data.gouv.fr/fr/dataservices/api-recherche-dentreprises/`
- `https://www.data.gouv.fr/api/1/dataservices/672cf684c3488a0c533f7094/`
- `https://www.data.gouv.fr/fr/datasets/donnees-des-entreprises-utilisees-dans-lannuaire-des-entreprises/`
- `https://www.data.gouv.fr/api/1/datasets/donnees-des-entreprises-utilisees-dans-lannuaire-des-entreprises/`
- `https://www.data.gouv.fr/fr/datasets/nomenclature-dactivites-francaise-naf-rev-2-code-ape/`
- `https://www.data.gouv.fr/api/1/datasets/nomenclature-dactivites-francaise-naf-rev-2-code-ape/`
- `https://www.data.gouv.fr/api/1/datasets/r/813e638d-f6b4-4742-90bb-bce13af21c88`
- `https://api.gouv.fr/guides/quelle-api-sirene`

Code source du service et du site (GitHub, organisation `annuaire-entreprises-data-gouv-fr`) :

- `https://github.com/etalab/annuaire-entreprises-search-api` (redirige vers le dépôt suivant)
- `https://github.com/annuaire-entreprises-data-gouv-fr/search-api`
- `https://api.github.com/repos/annuaire-entreprises-data-gouv-fr/search-api`
- `https://api.github.com/repos/annuaire-entreprises-data-gouv-fr/search-api/releases?per_page=8`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/doc/open-api.yml`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/routers/public.py`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/elastic/parsers/siret.py`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/elastic/filters/siret.py`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/elastic/queries/text.py`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/elastic/text_search.py`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/controller/field_validation.py`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/utils/helpers.py`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/service/format_search_results.py`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/service/formatters/nom_complet.py`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/service/formatters/non_diffusible.py`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/labels/codes-NAF.json`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/labels/tranches-effectifs.json`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-api/main/app/labels/natures-juridiques.json`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/search-infra/main/README.md`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/site/main/src/routes/_header-default/vie-privee.tsx`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/site/main/src/routes/_header-default/donnees.api-entreprises.tsx`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/site/main/src/data/faq/frequence-mise-a-jour-donnees.yml`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/site/main/src/data/faq/reutiliser-les-donnees.yml`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/site/main/src/data/faq/entreprise-non-diffusible.yml`
- `https://raw.githubusercontent.com/annuaire-entreprises-data-gouv-fr/site/main/src/data/faq/supprimer-donnees-personnelles-entreprise.yml`
- `https://annuaire-entreprises.data.gouv.fr/vie-privee` (bloquée par Incapsula)
- `https://annuaire-entreprises.data.gouv.fr/donnees/api#recherche-entreprise` (bloquée par Incapsula)
- `https://annuaire-entreprises.data.gouv.fr/faq/parcours?question=contact`

Nomenclatures INSEE :

- `https://www.insee.fr/fr/information/2120875` (NAF rév. 2)
- `https://www.insee.fr/fr/statistiques/fichier/2120875/int_courts_naf_rev_2.xls`
- `https://www.insee.fr/fr/information/8617910` (NAF 2025)
- `https://www.insee.fr/fr/statistiques/fichier/8617910/Structure%20NAF%202025%20Maj%202024-10-04.xlsx`
- `https://www.insee.fr/fr/information/8181066` (calendrier NAF 2025)

Fichiers locaux :

- `docs/reference/recherche-entreprises.openapi.json`
- `docs/reference/recherche-entreprises.sample.json`
- `docs/reference/recherche-entreprises.tranches-effectifs.json`
- `docs/reference/naf-rev2-codes-labels.json`
- `docs/BRIEF.md` (sections 3.2, 4, 6)
