# API Adresse et service de géocodage de la Géoplateforme (IGN)

Dernière vérification : 9 septembre 2026

Document de référence pour l'intégration du géocodage dans Candidatly (étape 4 de l'onboarding, brief §5.1 : autocomplétion d'adresse, latitude / longitude et code INSEE du profil). Il est rédigé à partir de la documentation officielle, de la spécification OpenAPI en ligne, du code source public du géocodeur et de requêtes réelles exécutées le 9 septembre 2026. Les copies locales des sources primaires sont dans `docs/reference/` :

- `docs/reference/geopf-geocodage.openapi.yaml` (copie de `https://data.geopf.fr/geocodage/openapi.yaml`, 64 071 octets, identique à la version en ligne au moment de la vérification) ;
- `docs/reference/geopf-geocodage.getcapabilities.json` (copie de `GET /getCapabilities`) ;
- `docs/reference/api-adresse.sample.json` (réponses réelles, tronquées).

Toute affirmation qui n'a pas pu être confirmée sur une source primaire est précédée de « ⚠️ Non vérifié : ». Ne pas implémenter ces points sans les retester.

## Résumé en 5 points

1. **URL de base à utiliser : `https://data.geopf.fr/geocodage`**, endpoints `GET /search` (géocodage direct, autocomplétion) et `GET /reverse` (géocodage inverse). L'hôte `https://api-adresse.data.gouv.fr` cité dans le brief (§5.1) est déprécié (en-têtes `deprecation` et `sunset` au 31 janvier 2026, fin de redirection annoncée pour le 14 avril 2026) ; il répond encore le 9 septembre 2026 mais peut cesser sans préavis. Ne jamais le coder dans le projet, même en secours.
2. **Pas de clé, pas d'inscription** : accès ouvert, CORS `*`. Quota de **50 requêtes par seconde et par adresse IP**, dépassement = HTTP 429 avec blocage de 5 secondes et en-tête `retry-after`.
3. **Réponse GeoJSON** (`FeatureCollection`). Les coordonnées utiles sont `geometry.coordinates` dans l'ordre **[longitude, latitude]**. Les propriétés `x` / `y` sont en projection Lambert-93 (mètres) malgré ce que dit l'OpenAPI : ne jamais les utiliser comme lon / lat.
4. **Code INSEE** : `properties.citycode`. À Paris, Lyon et Marseille, une adresse renvoie le code de l'**arrondissement** (`75104`, `69382`, `13201`), avec `city` = ville et `district` = libellé de l'arrondissement ; la commune entière (`75056`, `69123`, `13055`) n'apparaît que comme feature `type=municipality`. Prévoir la dérivation commune parente côté serveur si nécessaire.
5. **Licence Ouverte 2.0** (Etalab) : réutilisation commerciale autorisée, obligation de mentionner la source et la date de mise à jour. Les réponses ne contiennent aucun champ `licence` / `attribution` : la mention doit être ajoutée par le projet (mentions légales et sous le champ d'adresse).

## 1. Statut du service et URL de base

### 1.1 Chronologie du transfert de la DINUM à l'IGN

| Date | Fait | Source |
|---|---|---|
| 3 avril 2025 | Billet « L'API Adresse de la Base Adresse Nationale est transférée à l'IGN » : l'API Adresse opérée par la DINUM passe sous gestion IGN dans la Géoplateforme. `https://api-adresse.data.gouv.fr/search/` est remplacée par `https://data.geopf.fr/geocodage/search/`. Bascule progressive au premier semestre 2025, transfert complet visé au 30 juin 2025, nom de domaine maintenu (redirection) jusqu'en janvier 2026. Nouveau service annoncé « iso-fonctionnel » (appels unitaires, autocomplétion, CSV) avec en plus la recherche de points d'intérêt et de parcelles cadastrales. ⚠️ Non vérifié : le billet indiquerait un volume d'environ 500 millions de requêtes par mois. | Copie du billet sur data.gouv.fr (le billet d'origine sur `adresse.data.gouv.fr/blog/` était en HTTP 503 pendant toute la vérification) |
| Page courante | Documentation officielle : « L'API Adresse BAN est dépréciée et intégrée dans le nouveau Service de géocodage de la Géoplateforme. L'url api-adresse.data.gouv.fr sera décommissionnée fin Janvier 2026. » | `https://adresse.data.gouv.fr/outils/api-doc/adresse` |
| 5 janvier 2026 | Fermeture de la démarche simplifiée « Demande de levée de limite de l'API Base Adresse Nationale » ; les demandes passent par le contact IGN (voir §2.3). | `https://demarche.numerique.gouv.fr/fermeture/demande-de-levee-de-limite-de-l-api-base-adresse` |
| 18 mars 2026 | Actualité cartes.gouv.fr : fermeture définitive du site `geoservices.ign.fr` le 26 mars 2026, toutes ses URL redirigées vers `cartes.gouv.fr` ; `geoportail.gouv.fr` suivra « dans les prochains mois ». Ne pointer aucune documentation vers ces deux domaines. | `https://cartes.gouv.fr/actualites/fermeture-du-site-geoservices-le-26-mars-poursuivez-vos-usages-sur-cartesgouvfr` |
| 23 mars 2026 | Actualité cartes.gouv.fr « Fin de la redirection de l'API BAN » : « La redirection du domaine https://api-adresse.data.gouv.fr vers l'API IGN s'arrête au 14 avril 2026. Après cette date, vos intégrations doivent impérativement utiliser le service de géocodage de la Géoplateforme ». | `https://cartes.gouv.fr/actualites/fin-de-la-redirection-de-lapi-ban` |

Les anciennes URL de documentation IGN (`https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage`) redirigent en 301 vers le guide `https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/`.

### 1.2 État réel de l'ancien hôte le 9 septembre 2026

`GET https://api-adresse.data.gouv.fr/search/?q=8%20bd%20du%20port&limit=3` répond encore **HTTP 200** avec un corps strictement identique à celui de `https://data.geopf.fr/geocodage/search?q=8%20bd%20du%20port&limit=3` (même `etag: W/"639-OPKuk8r7iGgEkLpgrYd64y85afM"`). Ce n'est pas une redirection 3xx : la réponse est servie directement par l'infrastructure Géoplateforme, avec les en-têtes suivants :

```http
HTTP/2 200
deprecation: Sat, 31 Jan 2026 22:59:59 GMT
sunset: Sat, 31 Jan 2026 22:59:59 GMT
x-api-deprecated: true
x-api-new-host: https://data.geopf.fr/geocodage/
x-api-migration: permanent
x-api-notice: L'URL api-adresse.data.gouv.fr va etre decommissionnee. Merci d'utiliser l'URL de la Geoplateforme https://data.geopf.fr/geocodage/
location: https://data.geopf.fr/geocodage/search/?q=8%20bd%20du%20port&limit=3
```

⚠️ Non vérifié : un en-tête `x-api-old-host: https://api-adresse.data.gouv.fr` a également été relevé.

La racine `https://api-adresse.data.gouv.fr/` répond HTTP 404 « Not Found » avec les mêmes en-têtes `deprecation` / `sunset`. Le jour où l'ancien hôte deviendra un vrai 301 / 302 ou un 404 / 410, un client qui ne suit pas les redirections ou ne gère pas la coupure tombera en panne.

Conclusion : l'arrêt annoncé pour le 14 avril 2026 n'était pas effectif à la date de vérification, aucune source ne donne de nouvelle date, et l'hôte doit être considéré comme pouvant cesser à tout moment.

### 1.3 Décision pour le projet

- URL de base : **`https://data.geopf.fr/geocodage`**. Ne jamais utiliser `api-adresse.data.gouv.fr`, ni même en secours : le corps des réponses est identique, il n'y a donc aucun bénéfice, et l'hôte est en sunset.
- Le brief (§5.1) cite `https://api-adresse.data.gouv.fr` : écart à tracer dans `docs/QUESTIONS.md` et dans le journal des décisions de `CLAUDE.md`.
- Recommandation projet : lire l'URL depuis `lib/env.ts` (`GEOCODING_API_BASE_URL`, valeur par défaut `https://data.geopf.fr/geocodage`) plutôt que de la coder en dur, pour pouvoir pointer vers un mock en test.

## 2. Authentification, accès et quotas

### 2.1 Accès ouvert, sans clé

- Aucune clé ni inscription pour `/search` et `/reverse` : la fiche data.gouv.fr du service indique « Accès : Ouvert », et le schéma OpenAPI ne déclare aucune `security` sur ces routes. Les schémas de sécurité `ProjectAuth` / `BearerAuth` de l'OpenAPI ne concernent que le géocodage par lot asynchrone.
- Un mode authentifié existe pour l'espace de travail Géoplateforme : OAuth2 avec en-tête `Authorization: Bearer <token>` et en-tête `X-Community` pour des quotas relevés, sur demande à `geoplateforme@ign.fr` (CGU cartes.gouv.fr, guide géocodage). Il n'est pas nécessaire au MVP.
- Rien à stocker dans `.env` hormis l'URL de base (§1.3).

### 2.2 Rate limiting

| Élément | Valeur | Source |
|---|---|---|
| Limite `/search` et `/reverse` | **50 requêtes par seconde et par adresse IP** | `adresse.data.gouv.fr/outils/api-doc/adresse`, guide cartes.gouv.fr, fiche data.gouv.fr, CGU cartes.gouv.fr (annexe 3, version du 15 octobre 2024) |
| Dépassement | HTTP **429** Too Many Requests, blocage de **5 secondes**. « La durée du blocage est indiquée dans un header "retry-after", avec une durée initialisée à 5 secondes et qui décroît à partir du moment où la sur-sollicitation cesse » | `adresse.data.gouv.fr/outils/api-doc/adresse` ; CGU cartes.gouv.fr (429 et 5 s, sans mention de `retry-after`) |
| Limite `/completion` (API distincte, §3.5) | 10 requêtes par seconde et par IP | Guide autocomplétion cartes.gouv.fr |
| Disponibilité annoncée | 99,5 % | Fiche data.gouv.fr |
| En-têtes présents sur chaque réponse (200 comme 400, sur les deux hôtes) | `ratelimit-limit: 50` et `x-ratelimit-limit-second: 1` | Observé |

Remarques :

- Aucun en-tête `ratelimit-remaining` ni `retry-after` n'a été observé sur une réponse normale. La signification exacte de `x-ratelimit-limit-second: 1` (fenêtre de 1 s ?) n'est documentée nulle part. Le comportement réel du 429 (corps, en-têtes) n'a pas été testé pour ne pas déclencher le blocage.
- Le quota est **par IP** : si les appels passent par un proxy serveur (route handler Vercel), tous les utilisateurs partagent les quelques IP sortantes de la plateforme. Voir §7.2.

### 2.3 Demande de levée de quota

- L'ancienne démarche BAN est close depuis le 5 janvier 2026 ; elle renvoyait vers `https://geoservices.ign.fr/contact`, qui redirige désormais (301, site fermé le 26 mars 2026) vers `https://cartes.gouv.fr/aide/fr/nous-ecrire/`.
- Le site carte-facile (La Fabrique des géocommuns, IGN) indique que la hausse de quota vise les organismes publics et conseille aux autres l'auto-hébergement. Le géocodeur est publié dans le dépôt `Geoplateforme/gpf-geocodeur` : la licence MIT est indiquée dans `package.json` (`"license": "MIT"`) et dans le README, mais le dépôt n'a pas de fichier `LICENSE` (l'API GitHub renvoie `license: null`).
- Pour Candidatly, 50 req/s/IP est très au-dessus du besoin (une autocomplétion d'adresse par onboarding) ; aucune demande n'est à prévoir.

## 3. Endpoints

### 3.1 Vue d'ensemble

Spécification : OpenAPI 3.1.0 « API Géoplateforme - Géocodage » version 1.0.0, `servers[0].url = https://data.geopf.fr/geocodage`, `info.license` = « Licence ouverte 2.0 », `termsOfService` = `https://cartes.gouv.fr/cgu`.

| Méthode et chemin | Rôle | Utilisé par le projet |
|---|---|---|
| `GET /search` | Géocodage direct (texte vers coordonnées), autocomplétion | **Oui** (onboarding) |
| `GET /reverse` | Géocodage inverse (coordonnées vers adresse) | Optionnel (revalidation serveur) |
| `GET /getCapabilities` | Découverte : opérations, index, champs, valeurs de `category` | Non (référence) |
| `GET /openapi.yaml` | Spécification OpenAPI (`text/yaml`) | Non (référence) |
| `POST /search/csv`, `POST /reverse/csv` | Géocodage par lot synchrone (CSV UTF-8, moins de 50 Mo ou 200 000 lignes) | Non |
| `/async/projects…` | Géocodage par lot asynchrone (jusqu'à 1 Go), authentification OAuth2 (`ProjectAuth`, `BearerAuth`) | Non |
| `GET /completion` | API « Autocomplétion » distincte, absente de `openapi.yaml`, quota 10 req/s/IP | **Non** (voir §3.5) |
| `GET /completion/getCapabilities`, `GET /completion/openapi.yaml` | Découverte de l'API d'autocomplétion | Non |

⚠️ Non vérifié : observations complémentaires de routage. `/search` et `/search/` (slash final) répondent tous deux 200 ; `/getcapabilities` en minuscules répond 200 comme `/getCapabilities` ; `GET /openapi` sert une Swagger UI (HTML) qui charge `openapi.yaml` ; `POST /search`, la racine `https://data.geopf.fr/geocodage/` et `/openapi.json` répondent 404.

Points de vigilance sur l'OpenAPI (ne pas générer un client à partir du seul fichier) :

- `q` y est déclaré `required: false` (autorisé vide uniquement pour une recherche structurée sur l'index `parcel`), alors que le serveur exige `q` pour l'index `address` (400 `q: required param`).
- Le schéma `AddressProperties` omet `banId`, `depcode`, `context`, `importance`, `oldcitycode`, `oldcity`, `population` et `municipality`, déclare un `_score` jamais renvoyé, et décrit `x` / `y` comme longitude / latitude alors que ce sont des coordonnées en projection légale (voir §4.2).
- `/completion` n'y figure pas.

Conséquence : le schéma Zod du projet doit se fonder sur `getCapabilities` et sur les réponses réelles, avec passthrough des champs inconnus.

### 3.2 `GET /search` : géocodage direct

Sources croisées : `openapi.yaml`, `getCapabilities`, code de validation `api/params/base.js` du dépôt `Geoplateforme/gpf-geocodeur`, requêtes réelles.

| Paramètre | Type | Obligatoire | Défaut | Valeurs autorisées et contraintes |
|---|---|---|---|---|
| `q` | string | Oui pour l'index `address` (le serveur renvoie 400 `q: required param` sans lui ; l'OpenAPI le déclare `required: false` pour le cas `parcel`) | | 3 à 200 caractères, premier caractère lettre ou chiffre (fonction `isFirstCharValid` de `base.js` : caractère possédant une casse, ou code point 48 à 57). `q=ab` et `q=-paris` donnent 400 `q: must contain between 3 and 200 chars and start with a number or a letter`. Incompatible avec les paramètres de recherche structurée `parcel`. ⚠️ Non vérifié : `q=lyo` (3 caractères) renvoie « Lyon » ; accents et apostrophes acceptés (`1 rue de l'Église Saint-Étienne` renvoie 1 résultat) ; une requête réaliste de 184 caractères passe, une de 230 caractères donne le 400 ci-dessus. Piège : un seul mot très long (60, 100 ou 200 lettres identiques) provoque un **HTTP 500 corps vide**, non documenté (§5). |
| `index` | string | Non | `address` | `address`, `poi`, `parcel` ; plusieurs valeurs séparées par des virgules. `index=poi` renvoie des propriétés différentes (§4.3). |
| `limit` | integer | Non | 10 | 1 à 50 (OpenAPI : « La valeur ne peut pas dépasser 50. Dans le cas où returntruegeometry est activé, la valeur est automatiquement ramenée à 20. »). `limit=51` et `limit=100` donnent 400 `limit: must be an integer between 1 and 50` ; `limit=50` renvoie 50 features ; sans `limit`, 10 features. Note : le code public du dépôt (`main` et tag `3.1.4`) borne à 20 et le tag `3.0.0` avait un défaut à 5 ; la production ne correspond pas au dépôt public, faire foi à l'OpenAPI en ligne et au comportement observé. ⚠️ Non vérifié : `api/indexes/address.js` forcerait en interne `Math.max(limit, 10)` vers addok puis tronquerait. |
| `autocomplete` | string enum `"1"` / `"0"` (OpenAPI) | Non | `1` | « Pertinent uniquement pour la saisie en direct d'utilisateurs » (`getCapabilities`). Mettre `0` pour une revalidation serveur d'une adresse complète. ⚠️ Non vérifié : le code accepterait aussi `true` / `yes` / `false` / `no` (insensible à la casse) ; pour « 8 bd du port », même premier résultat avec un score de 0,4924 (`autocomplete=1`) contre 0,5403 (`autocomplete=0`). |
| `lat`, `lon` | float | Non, mais **ensemble** | | `lat` entre -90 et 90, `lon` entre -180 et 180. Point de préférence pour favoriser les candidats les plus proches. `lon` seul : 400 `lon/lat must be present together if defined` ; `lat=abc` : 400 `lat: unable to parse value as float`. Quand ils sont fournis, chaque feature reçoit une propriété `distance` (entier, mètres, ex. 273 pour « 8 bd du port » avec `lat=49.03&lon=2.06`). |
| `type` | string enum | Non | | `housenumber`, `street`, `locality`, `municipality` (index `address` uniquement). `type=foo` : 400 `type: unexpected value 'foo'`. **Une seule valeur** : `type=street&type=municipality` n'applique que la dernière valeur (résultats `municipality` seulement) ; `type=street,municipality` et `type=street+municipality` donnent 400 `type: unexpected value 'street,municipality'`. La syntaxe multi-valeur d'addok ne fonctionne donc pas sur la Géoplateforme. |
| `postcode` | string | Non | | Schéma `PostalCode` : exactement 5 caractères, regex du code `^\d{5}$`. Plusieurs valeurs séparées par des virgules, max 50. Filtre les index `address` et `poi`. |
| `citycode` | string | Non | | Schéma `InseeCode` : 2 à 5 caractères ; regex du code `^(\d{5}\|\d[AB]\d{3})$` (codes corses `2A` / `2B` acceptés). Plusieurs valeurs, max 200 sur `/search`. Filtre les index `address` et `poi`. Comportement à Paris : §6. |
| `depcode` | string | Non | | Schéma `DepCode` : 2 à 3 caractères ; max 10 valeurs. Filtre les index `address` et `poi`. |
| `city` | string | Non | | Nom de commune. Incompatible avec `citycode` (400 `city and citycode params cannot be used together`) et avec l'index `parcel`. ⚠️ Non vérifié : max 50 caractères ; si aucune commune ne correspond, 400 `city: No matching cities found`. |
| `category` | string | Non | | Index `poi` uniquement ; valeurs listées dans `getCapabilities`. ⚠️ Non vérifié : max 10 valeurs. |
| `returntruegeometry` | boolean | Non | `false` | Renvoie la vraie géométrie (index `poi` et `parcel`) ; ramène `limit` à 20. |
| `departmentcode`, `municipalitycode`, `oldmunicipalitycode`, `districtcode`, `section`, `number`, `sheet` | string | Non | | Recherche structurée, index `parcel` uniquement. Sans intérêt pour le projet. ⚠️ Non vérifié : combinés avec `q`, 400 `q param and structured search cannot be used together`. |

Exemple de requête (autocomplétion pendant la saisie) :

```bash
curl -s "https://data.geopf.fr/geocodage/search?q=10%20rue%20de%20rivoli%20paris&limit=1&autocomplete=1"
```

Réponse réelle, complète :

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [2.36041, 48.8555] },
      "properties": {
        "label": "10 Rue de Rivoli 75004 Paris",
        "score": 0.9701581818181818,
        "housenumber": "10",
        "id": "75104_8249_00010",
        "banId": "10ee511a-2616-4186-948f-ab4ae0dffab4",
        "name": "10 Rue de Rivoli",
        "postcode": "75004",
        "citycode": "75104",
        "x": 653070.41,
        "y": 6861908.04,
        "city": "Paris",
        "district": "Paris 4e Arrondissement",
        "context": "75, Paris, Île-de-France",
        "type": "housenumber",
        "importance": 0.67174,
        "depcode": "75",
        "street": "Rue de Rivoli",
        "_type": "address"
      }
    }
  ],
  "query": "10 rue de rivoli paris"
}
```

Exemple de recherche d'une commune (pour un rayon de recherche centré sur une ville) :

```bash
curl -s "https://data.geopf.fr/geocodage/search?q=lyon&type=municipality&limit=1"
```

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [4.835, 45.758] },
      "properties": {
        "label": "Lyon",
        "score": 0.9639145454545454,
        "id": "69123",
        "type": "municipality",
        "name": "Lyon",
        "postcode": "69001",
        "citycode": "69123",
        "x": 842627.75,
        "y": 6519256.98,
        "population": 519127,
        "city": "Lyon",
        "context": "69, Rhône, Auvergne-Rhône-Alpes",
        "importance": 0.60306,
        "depcode": "69",
        "municipality": "Lyon",
        "_type": "address"
      }
    }
  ],
  "query": "lyon"
}
```

Exemple d'adresse dans une commune nouvelle (Cran-Gevrier, fusionnée dans Annecy) :

```bash
curl -s "https://data.geopf.fr/geocodage/search?q=1%20rue%20de%20la%20gare%20cran-gevrier&limit=1"
```

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [6.109739, 45.910763] },
      "properties": {
        "label": "Rue de la Crête 74960 Annecy",
        "score": 0.6552063636363636,
        "id": "74010_0672",
        "banId": "c6c07663-56e7-4fda-b566-2e8adab1622e",
        "name": "Rue de la Crête",
        "postcode": "74960",
        "citycode": "74010",
        "oldcitycode": "74093",
        "x": 940999.83,
        "y": 6539310.26,
        "city": "Annecy",
        "oldcity": "Cran-Gevrier",
        "context": "74, Haute-Savoie, Auvergne-Rhône-Alpes",
        "type": "street",
        "importance": 0.73852,
        "depcode": "74",
        "street": "Rue de la Crête",
        "_type": "address"
      }
    }
  ],
  "query": "1 rue de la gare cran-gevrier"
}
```

Recherche sans résultat : HTTP 200 avec `features` vide.

```json
{ "type": "FeatureCollection", "features": [], "query": "zzzzqqqqxxxx" }
```

Codes de réponse déclarés dans l'OpenAPI pour `/search` : `200` et `400` (« Parse query failed ») uniquement. Codes réellement rencontrés : voir §5.

### 3.3 `GET /reverse` : géocodage inverse

| Paramètre | Type | Obligatoire | Défaut | Valeurs autorisées et contraintes |
|---|---|---|---|---|
| `lon`, `lat` | float | Oui, ensemble, si `searchgeom` est absent | | Point de recherche (un cercle est créé autour) et point d'ordonnancement. `lon` sans `lat` : 400 `lon/lat must be present together if defined` ; `lat=abc` : 400 `lat: unable to parse value as float`. ⚠️ Non vérifié : sans `lon` / `lat` ni `searchgeom`, 400 `At least lon/lat or searchgeom must be defined`. |
| `searchgeom` | string (GeoJSON) | Non | | Géométrie `Point`, `LineString`, `Polygon` ou `Circle` (ex. `{"type":"Circle","coordinates":[lon,lat],"radius":100}`). Pour l'index `address`, seuls `Polygon` et `Circle`. Plus grand côté de l'emprise limité à 1 000 m. |
| `index` | string | Non | `address` | Comme `/search`. |
| `limit` | integer | Non | 10 | Comme `/search` (1 à 50). |
| `type` | string enum | Non | | Comme `/search` (une seule valeur). Attention : `type=municipality` renvoie **0 feature au point de Paris** (2.36041, 48.8555) mais 1 feature à Lyon (4.835, 45.758). Ne pas utiliser `/reverse` pour retrouver la commune. |
| `postcode`, `citycode`, `depcode`, `city`, `category`, `returntruegeometry`, paramètres `parcel` | | Non | | Comme `/search`, sauf `citycode` limité à 50 valeurs sur `/reverse`. |

Exemple :

```bash
curl -s "https://data.geopf.fr/geocodage/reverse?lon=2.37&lat=48.357&limit=1"
```

Réponse réelle (tronquée à une feature) :

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [2.371203, 48.355924] },
      "properties": {
        "type": "housenumber",
        "name": "23 Grande Rue",
        "label": "23 Grande Rue 91720 Prunay-sur-Essonne",
        "street": "Grande Rue",
        "postcode": "91720",
        "citycode": "91507",
        "city": "Prunay-sur-Essonne",
        "oldcitycode": null,
        "oldcity": null,
        "context": "91, Essonne, Île-de-France",
        "importance": 0.26922,
        "housenumber": "23",
        "id": "91507_0100_00023",
        "banId": "b7f4c615-1356-4e73-87d0-acbe23125963",
        "x": 653420.06,
        "y": 6806364.89,
        "distance": 149,
        "score": 0.9851,
        "_type": "address"
      }
    }
  ]
}
```

Différences avec `/search` : pas de clé racine `query` ; `oldcitycode` et `oldcity` renvoyés explicitement à `null` quand sans objet (absents sur `/search`) ; `distance` et `score` toujours présents ; `depcode` absent des réponses capturées. Sur un `/reverse` avec `type=municipality` (Lyon), la feature porte `banId: null` et un `label` composite « 69001,69002,...,69009 Lyon » : utiliser `city` ou `name`, pas `label`, pour afficher une commune obtenue par reverse.

### 3.4 `GET /getCapabilities`

Sans paramètre. Renvoie la liste des opérations, des index (`address`, `poi`, `parcel`), des paramètres et des champs de réponse par index, ainsi que les valeurs admises pour `category`. Copie locale : `docs/reference/geopf-geocodage.getcapabilities.json`. C'est la source qui décrit correctement `x` / `y` (« coordonnées géographique en projection légale ») et les champs `district`, `oldcitycode`, `oldcity`, `context`, `importance` absents de l'OpenAPI.

### 3.5 `GET /completion` : API Autocomplétion, non retenue

Endpoint `https://data.geopf.fr/geocodage/completion/`, documenté séparément (guide « Autocomplétion » de cartes.gouv.fr), absent de `openapi.yaml`.

| Paramètre | Contraintes |
|---|---|
| `text` | Obligatoire |
| `type` | `PositionOfInterest`, `StreetAddress` |
| `maximumResponses` | 1 à 15 |
| ⚠️ Non vérifié : `terr`, `poiType`, `lonlat`, `bbox`, `depcode` (max 10), `zipcode` (max 50), `citycode` (max 200) | Listés dans le guide, non testés |

Limite : **10 requêtes par seconde et par IP**. Réponse observée :

```bash
curl -s "https://data.geopf.fr/geocodage/completion?text=10%20rue%20de%20rivoli%20paris&type=StreetAddress&maximumResponses=1"
```

```json
{
  "status": "OK",
  "results": [
    {
      "x": 2.36041,
      "y": 48.8555,
      "country": "StreetAddress",
      "city": "Paris",
      "oldcity": "",
      "kind": "housenumber",
      "zipcode": "75004",
      "street": "Rue de Rivoli",
      "metropole": true,
      "fulltext": "10 Rue de Rivoli, 75004 Paris",
      "classification": 7
    }
  ]
}
```

Ici `x` / `y` sont bien lon / lat (contrairement à `/search`), mais **aucun `citycode`** n'est renvoyé et le quota est cinq fois plus faible. Le projet a besoin du code INSEE : utiliser `/search` avec `autocomplete=1`.

## 4. Format de réponse

### 4.1 Enveloppe

- `/search` : `{"type":"FeatureCollection","features":[…],"query":"<q tel qu'envoyé, décodé>"}`.
- `/reverse` : `{"type":"FeatureCollection","features":[…]}` sans `query`.
- Aucune clé racine `attribution`, `licence`, `version` ni `limit` : ces clés du projet addok générique ne sont présentes ni sur la Géoplateforme ni sur l'ancien hôte.
- Chaque feature : `{"type":"Feature","geometry":{"type":"Point","coordinates":[lon, lat]},"properties":{…}}`. Ordre des coordonnées **[longitude, latitude]** (schéma `GeometryPoint`), ex. `[2.36041, 48.8555]` pour 10 rue de Rivoli à Paris.
- `Content-Type: application/json; charset=utf-8`.

### 4.2 Propriétés de l'index `address`

Sources : réponses réelles, `getCapabilities`, schéma `AddressProperties` (incomplet, voir §3.1).

| Champ | Type | Présence | Description et remarques |
|---|---|---|---|
| `label` | string | toujours | Libellé complet : `10 Rue de Rivoli 75004 Paris` ; `Lyon` pour une commune. Composite et inexploitable pour une `municipality` obtenue par `/reverse` (§3.3). |
| `score` | number (0 à 1) | toujours | Pertinence. |
| `id` | string | toujours | Identifiant BAN. Format observé : `<citycode>_<id voie>_<numéro>` pour un `housenumber` (`75104_8249_00010`), `<citycode>_<id voie>` pour une `street` (`75101_8249`), code INSEE seul pour une `municipality` (`69123`, `75056`). |
| `banId` | string (UUID) ou null | variable | Présent sur les `housenumber` et `street` observés, sur certaines `municipality` (Paris 4e) et absent sur d'autres (Lyon) ; `null` sur une `municipality` en reverse. Absent du schéma OpenAPI. Traiter comme optionnel et nullable. |
| `type` | string enum | toujours | `housenumber`, `street`, `locality`, `municipality`. |
| `_type` | string | toujours | `"address"` (« rétro-compatibilité » ; les POI ont `"poi"`). |
| `name` | string | toujours | Numéro éventuel + voie ou lieu-dit (`8 Boulevard du Port`, `Lyon`). |
| `housenumber` | string | type `housenumber` | Avec indice de répétition éventuel (bis, ter, A, B). |
| `street` | string | `housenumber` et `street` | Nom de la voie. |
| `postcode` | string (5 chiffres) | toujours | Pour une `municipality` à plusieurs codes postaux, un seul est renvoyé (Paris → `75001`, Lyon → `69001`, Marseille → `13001`). |
| `citycode` | string | toujours | **Code INSEE**. Arrondissement pour une adresse à Paris, Lyon, Marseille (§6). |
| `depcode` | string | `/search` (observé) ; absent des réponses `/reverse` capturées | Code département (`95`, `75`). Absent du schéma OpenAPI. |
| `city` | string | toujours | Nom de la commune. Adresse à Paris : `Paris` ; feature `municipality` d'arrondissement : `Paris 4e Arrondissement`. |
| `district` | string | Paris, Lyon, Marseille uniquement, sur `housenumber` et `street` | `Paris 4e Arrondissement`, `Lyon 2e Arrondissement`, `Marseille 1er Arrondissement`. Absent ailleurs. |
| `municipality` | string | type `municipality` | Nom de la commune (`Lyon`). Absent du schéma OpenAPI. |
| `population` | integer | type `municipality` | `519127` (Lyon), `2103778` (Paris), `27332` (Paris 4e). Absent du schéma OpenAPI. |
| `oldcitycode`, `oldcity` | string ou null | commune nouvelle | `74093` / `Cran-Gevrier` pour une adresse d'Annecy (`citycode` `74010`). `null` explicites sur `/reverse`, absents sur `/search` quand sans objet. |
| `context` | string | toujours | `95, Val-d'Oise, Île-de-France` (numéro de département, département, région). Absent du schéma OpenAPI. |
| `importance` | number | toujours | Indicateur technique. Absent du schéma OpenAPI. |
| `x`, `y` | number | toujours | **Coordonnées en projection légale (Lambert-93, mètres)**, ex. `x: 653070.41, y: 6861908.04` pour Paris. L'OpenAPI les décrit à tort comme longitude / latitude ; `getCapabilities` dit « coordonnées géographique en projection légale » et les valeurs le confirment. **Ne jamais les utiliser comme lon / lat ; prendre `geometry.coordinates`.** |
| `distance` | integer (mètres) | `/reverse`, ou `/search` avec `lat` / `lon` | Ex. `149`, `273`. |
| `_score` | number | jamais observé | Déclaré dans le schéma OpenAPI, non renvoyé en production. |

### 4.3 Propriétés de l'index `poi` (pour information)

Structure différente, observée sur `search?q=gare%20de%20lyon&index=poi&limit=1` : `name` (tableau), `toponym`, `category` (tableau), `postcode` (tableau), `citycode` (tableau, ex. `["69382","69123"]`), `depcode` (tableau), `city` (tableau), `extrafields.cleabs`, `classification`, `territory`, `score`, `_type: "poi"`. Non utilisé par le projet ; un schéma Zod construit pour `address` ne doit pas être appliqué à `poi`.

### 4.4 Architecture du service (pour comprendre les comportements)

Le géocodeur (`Geoplateforme/gpf-geocodeur`, `docs/architecture.md`) utilise le logiciel **addok** (Redis) pour la recherche textuelle des index `address` et `poi`, et LMDB avec un R-Tree Flatbush pour les recherches spatiales et structurées. Cela explique la proximité avec l'ancienne API Adresse (elle-même basée sur addok) et le fait que le paramètre `index` fonctionne aussi via l'ancien hôte, qui pointe sur la même infrastructure. Données : index adresses actualisé au moins chaque semaine depuis la BAN (« deux fois par semaine » selon adresse.data.gouv.fr, « chaque semaine » selon le guide cartes.gouv.fr) ; POI (BD TOPO) et parcelles (Parcellaire Express) chaque trimestre.

## 5. Erreurs

Format d'erreur 400, stable sur `/search` et `/reverse` : `{ "code": number, "message": string, "detail": string[] }`. À valider avec Zod et à traduire en message français à la frontière (route handler ou server action).

```json
{
  "code": 400,
  "message": "Failed parsing query",
  "detail": ["q: must contain between 3 and 200 chars and start with a number or a letter"]
}
```

| Cas | HTTP | Corps ou comportement |
|---|---|---|
| `q` trop court (< 3), > 200 caractères ou premier caractère non alphanumérique | 400 | `detail: ["q: must contain between 3 and 200 chars and start with a number or a letter"]` |
| `q` absent | 400 | `detail: ["q: required param"]` |
| `limit` hors 1 à 50 | 400 | `detail: ["limit: must be an integer between 1 and 50"]` |
| `type` inconnu ou multi-valeur avec virgule / plus | 400 | `detail: ["type: unexpected value 'foo'"]` |
| `lat` non numérique | 400 | `detail: ["lat: unable to parse value as float"]` |
| `lon` sans `lat` (ou l'inverse) | 400 | `detail: ["lon/lat must be present together if defined"]` |
| `city` et `citycode` ensemble | 400 | `city and citycode params cannot be used together` |
| Aucun résultat | 200 | `features: []` |
| Mot unique très long (60, 100 ou 200 lettres identiques, ex. `q=aaaa…` 60 fois) | 500 | Corps vide. Reproduit sur `data.geopf.fr` (60, 100, 200 lettres) et sur l'ancien hôte (60 lettres). Non documenté. Note : `q=-paris` donne un 400 ordinaire, pas un 500. |
| Racine `/`, `POST /search`, chemin inconnu | 404 | `Not Found` (text/plain ou HTML) |
| Quota dépassé (plus de 50 req/s/IP) | 429 | Blocage 5 s, en-tête `retry-after` décroissant (documenté, non testé) |

Recommandation projet pour le client `lib/geocoding/` :

- `AbortSignal.timeout(5000)` ; `User-Agent` identifiable pour les appels serveur.
- 400 : `ValidationError` ou `ExternalApiError` selon l'origine (une requête utilisateur trop courte ne doit jamais atteindre l'API : filtrer à 3 caractères côté client).
- 429 : `RateLimitedError`, respecter `retry-after` (au plus 5 s), pas de rejeu immédiat.
- 5xx et corps vide : `ExternalApiError` retryable, une seule nouvelle tentative ; tronquer les requêtes utilisateur à une longueur raisonnable (par exemple 120 caractères) et couper les mots de plus de 50 caractères avant l'appel, pour éviter le 500 non documenté.
- Réponse non conforme au schéma Zod : `ExternalApiError` avec le chemin Zod dans les logs, jamais l'adresse saisie (donnée personnelle).

## 6. Codes INSEE : Paris, Lyon, Marseille et communes nouvelles

Comportement observé le 9 septembre 2026 sur `data.geopf.fr` :

1. **Adresses et voies** dans les trois villes à arrondissements : `citycode` = code INSEE de l'**arrondissement**, `city` = nom de la ville, `district` = libellé de l'arrondissement, `postcode` = code postal de l'arrondissement, `id` préfixé par le code d'arrondissement.
   - `10 rue de Rivoli Paris` → `citycode: "75104"`, `city: "Paris"`, `district: "Paris 4e Arrondissement"`, `postcode: "75004"`, `id: "75104_8249_00010"`.
   - `Rue de Rivoli 75001` (street) → `citycode: "75101"`, `district: "Paris 1er Arrondissement"`.
   - `20 rue de la République Lyon` → `citycode: "69382"`, `city: "Lyon"`, `district: "Lyon 2e Arrondissement"`, `postcode: "69002"`.
   - `1 la Canebière Marseille` → `citycode: "13201"`, `city: "Marseille"`, `district: "Marseille 1er Arrondissement"`, `postcode: "13001"`.
2. **Recherche `type=municipality`** : la commune entière et chaque arrondissement sont des features distinctes.
   - `q=paris&type=municipality` → `75056` (`label: "Paris"`, `population: 2103778`, `postcode: "75001"`), puis `75115` (Paris 15e), `75120`…
   - `q=paris 4e&type=municipality` → `75104`, `city: "Paris 4e Arrondissement"`, `population: 27332`.
   - `q=lyon&type=municipality` → `69123` (Lyon), puis `69383`, `69387` ; `q=marseille&type=municipality` → `13055` (Marseille), puis `13213`, `13208`.
   - Avec le filtre `postcode=75004` : renvoie `75056` (Paris) **et** `75104` (Paris 4e).
3. **Filtre `citycode`** : `citycode=75056` ne restreint pas au niveau commune : les résultats renvoyés portent `citycode` `75104` et `75101` (le filtre accepte le code de la commune parente pour les adresses d'arrondissement). `citycode=75104` restreint bien au 4e.
4. **Communes nouvelles** : `citycode` = commune actuelle (`74010` Annecy), avec `oldcitycode: "74093"` et `oldcity: "Cran-Gevrier"`.
5. **`/reverse` avec `type=municipality`** : 0 feature au point de Paris, 1 feature à Lyon. Ne pas s'en servir pour retrouver la commune.

Lien avec l'API Alternance (`docs/reference/api-alternance.openapi.json`, voir `docs/API_ALTERNANCE.md`) : la recherche d'offres `GET /job/v1/search` se fait par `latitude`, `longitude` et `radius` (0 à 200 km, défaut 30), pas par code INSEE. L'endpoint `GET /geographie/v1/commune/search` prend un paramètre `code` (`^\d{5}$`, INSEE ou postal, exemple `75056`) et son schéma `Commune` expose `code.insee`, `code.postaux[]`, `anciennes[]` (`codeInsee`) et `arrondissements[]` (`code`, `nom`). Le code INSEE « commune » attendu côté Alternance est donc du type `75056`, avec les arrondissements en sous-liste. Attention : l'OpenAPI de l'API Alternance déclare un code `419` pour TooManyRequests sur cette route (probable coquille pour 429), à ne pas recopier tel quel.

Recommandation projet pour `profiles.insee_code` :

- Stocker la valeur `citycode` renvoyée par le géocodeur (ex. `75104`) : c'est la clé cohérente avec `id` et `postcode`.
- Si un code de niveau commune est nécessaire (statistiques, croisement avec `/geographie/v1/commune/search`), le dériver côté serveur. ⚠️ Non vérifié : plages complètes `75101` à `75120` → `75056`, `69381` à `69389` → `69123`, `13201` à `13216` → `13055`. Seuls les codes `75101`, `75104`, `75115`, `75120`, `69381`, `69382`, `69383`, `69387`, `13201`, `13208`, `13213` ont été observés ; confirmer les bornes avec la nomenclature INSEE ou avec `GET /geographie/v1/commune/search?code=75056` (clé API Alternance requise), qui expose `arrondissements[].code`. Alternative sans table : détecter la présence de `district` et faire un second appel `search?q=<city>&type=municipality&limit=1`.
- Pour tout calcul de distance, utiliser `geometry.coordinates` (lon, lat), jamais `x` / `y`.

## 7. CORS, cache, conservation et architecture d'appel

### 7.1 CORS

Observé sur `data.geopf.fr` : `access-control-allow-origin: *`, `access-control-allow-methods: GET, PUT, POST, DELETE, PATCH, OPTIONS` ; un preflight `OPTIONS /search` avec `Origin` et `Access-Control-Request-Method: GET` répond **204**. Le code source active `cors({origin: true})` sauf si la variable `CORS_DISABLE` vaut `1`. Un appel `fetch` direct depuis le navigateur est donc techniquement possible, sans proxy ni clé. ⚠️ Non vérifié : en-têtes complémentaires relevés `access-control-allow-credentials: true`, `access-control-allow-headers: DNT,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Content-Disposition,Content-Length,X-Community`, `access-control-max-age: 1728000`.

### 7.2 Navigateur ou serveur : décision d'architecture

- Le brief (§9) impose que tout appel externe passe par `/lib` avec schéma Zod, timeout et erreur typée, et que les appels externes se fassent côté serveur. `CLAUDE.md` (§5 et §6) prévoit en conséquence un route handler `app/api/geocode` (proxy serveur vers le géocodage) « même si l'API est publique ».
- Contre-argument technique : il n'y a aucun secret à protéger et le quota de 50 req/s est **par IP**. Proxifier via Vercel concentre tous les utilisateurs sur quelques IP sortantes, alors qu'un appel navigateur répartit le quota sur les IP des étudiants. Au volume du MVP (une autocomplétion par onboarding), le proxy reste très loin du quota.
- Proposition à trancher dans `docs/QUESTIONS.md` : (a) client `lib/geocoding/geocode.ts` typé Zod, appelé depuis le route handler `/api/geocode` conformément à `CLAUDE.md`, avec cache court par requête normalisée et gestion du 429 ; (b) quel que soit le canal, revalidation côté serveur de la feature choisie (nouveau `search` sur le `label` avec `autocomplete=0`, ou `reverse` sur lon / lat) avant d'écrire `location_lat`, `location_lng` et `insee_code`, pour ne jamais faire confiance à des coordonnées venant du client.

### 7.3 Debounce et autocomplétion

Aucune recommandation officielle de debounce n'a été trouvée (adresse.data.gouv.fr, guide géocodage et guide autocomplétion de cartes.gouv.fr, carte-facile). Les seules contraintes documentées : `q` d'au moins 3 caractères (sinon 400), `autocomplete=1` réservé à la saisie en direct, quota 50 req/s/IP. Hypothèse projet à valider par l'owner : déclencher à partir de 3 caractères, debounce 300 ms, annulation de la requête précédente via `AbortController`, `limit=5`, filtre `type=housenumber` ou `type=municipality` selon le champ (un seul `type` par requête), et proposer en priorité les résultats `municipality` (villes) pour définir le centre du rayon de recherche.

### 7.4 Cache et conservation

- Aucune clause de rétention ou d'interdiction de cache n'a été relevée dans les sources consultées (documentation, fiche data.gouv.fr, CGU cartes.gouv.fr) ; ce point figure dans « Points restant à vérifier ». La Licence Ouverte 2.0 autorise la réutilisation, la modification et la conservation des données (§8).
- Recommandation projet : ne stocker que la feature validée par l'étudiant (`label`, lon / lat, `citycode`, éventuellement `postcode` et `city`) dans `profiles` ; cache mémoire ou KV court (quelques minutes) sur `q` normalisé côté route handler pour absorber les frappes répétées ; pas de cache long des suggestions, les données étant mises à jour au moins chaque semaine.
- RGPD : l'adresse saisie est une donnée personnelle. Ne pas la logger (ni `q`, ni `label`) ; le logger structuré ne doit contenir que le statut HTTP, la durée et le nombre de résultats.

## 8. Licence, conditions d'utilisation et attribution

| Élément | Détail | Source |
|---|---|---|
| Licence du service de géocodage | `info.license` = « Licence ouverte 2.0 » ; `termsOfService` = `https://cartes.gouv.fr/cgu`. La fiche data.gouv.fr indique « Open Licence 2.0 », producteur IGN-F, contact `geoplateforme@ign.fr`. | OpenAPI, fiche data.gouv.fr |
| CGU Géoplateforme (version du 15 octobre 2024) | La Licence Ouverte / Open Licence Etalab s'applique par défaut aux données servies ; usage autorisé pour du « développement à des fins commerciales ou non » ; interdiction de nuire au fonctionnement des API ; limites de débit en annexe 3 (50 req/s/IP pour le géocodage, 429, blocage 5 s). | `https://cartes.gouv.fr/cgu` |
| Données BAN | Jeu « Base Adresse Nationale » publié sur data.gouv.fr sous « Licence Ouverte / Open Licence version 2.0 ». L'organisation productrice affichée est « Base Adresse Nationale » ; la BAN est « placée sous la responsabilité du Premier ministre représenté par La Direction Interministérielle du Numérique (DINUM) » et « L'exploitation et la diffusion de la BAN sont pilotés par l'Institut National de l'Information Géographique et forestière (IGN) ». Ne pas écrire « produite par l'IGN ». | `https://www.data.gouv.fr/datasets/base-adresse-nationale/` |
| Obligations de la Licence Ouverte 2.0 | Réutilisation libre, gratuite, commerciale ou non, modification autorisée. Obligation de « mentionner la paternité de l'« Information » : sa source (a minima le nom du « Concédant ») et la date de la dernière mise à jour », mention pouvant être satisfaite par un lien URL. Compatible CC-BY, ODC-BY, OGL. L'URL `https://www.etalab.gouv.fr/licence-ouverte-open-licence` citée dans l'OpenAPI mène au texte publié sur data.gouv.fr (⚠️ Non vérifié : par redirection). | `https://www.data.gouv.fr/pages/legal/licences/etalab-2.0/` |

Les réponses ne contiennent aucun champ `licence` ou `attribution` : la mention doit être ajoutée manuellement par le projet, dans les mentions légales et sous le champ d'adresse de l'onboarding. Formulation proposée : « Adresses : Base Adresse Nationale (DINUM / IGN, service de géocodage de la Géoplateforme), Licence Ouverte 2.0 » avec un lien vers `https://adresse.data.gouv.fr` et la date de dernière mise à jour connue.

## 9. Pièges à connaître

1. **`x` / `y` ne sont pas lon / lat** (Lambert-93). Toujours lire `geometry.coordinates[0]` (longitude) et `[1]` (latitude).
2. **Arrondissements** : `citycode` d'une adresse parisienne, lyonnaise ou marseillaise est celui de l'arrondissement ; la commune parente n'existe que comme feature `municipality`. Le filtre `citycode=75056` renvoie quand même des adresses d'arrondissement (§6).
3. **Ancien hôte** : `api-adresse.data.gouv.fr` répond 200 avec `sunset` dépassé et un en-tête `location` ; ne jamais en dépendre.
4. **OpenAPI incomplet** : `q` déclaré facultatif, `AddressProperties` lacunaire, `_score` fantôme, `/completion` absent. Construire le schéma Zod sur les réponses réelles avec passthrough.
5. **`type` mono-valeur** : la syntaxe multi-valeur d'addok (`type=a&type=b`, `a,b`, `a+b`) n'est pas supportée (dernière valeur retenue ou 400).
6. **`/reverse` et communes** : 0 feature avec `type=municipality` à Paris ; `label` composite et `banId: null` à Lyon. Ne pas l'utiliser pour retrouver la commune.
7. **`/completion`** : pas de `citycode`, quota 10 req/s/IP, `x` / `y` en lon / lat cette fois. Ne pas mélanger les deux formats.
8. **HTTP 500 corps vide** sur un mot unique très long : tronquer les entrées utilisateur avant l'appel.
9. **`postcode` d'une `municipality`** : un seul code postal renvoyé pour une ville multi-codes (`75001` pour Paris). Ne pas l'utiliser pour identifier la ville ; prendre `citycode`.
10. **`depcode` et `banId`** : présents sur `/search`, absents ou `null` sur certaines réponses `/reverse` ou `municipality`. Les déclarer optionnels.
11. **`limit`** : la production accepte 1 à 50 alors que le dépôt public borne à 20 ; ne pas se fier au code source pour les bornes.
12. **Pas de champ d'attribution dans les réponses** : la mention de licence est à la charge du projet (§8).

## 10. Synthèse pour l'implémentation (`lib/geocoding/`)

- Base : `GEOCODING_API_BASE_URL` (défaut `https://data.geopf.fr/geocodage`). Appels : `GET /search?q=&limit=5&autocomplete=1[&type=][&lat=&lon=]` pour l'autocomplétion, `GET /search?q=<label>&limit=1&autocomplete=0` ou `GET /reverse?lon=&lat=&limit=1` pour la revalidation serveur.
- `fetch` injectable pour les tests (aucun test ne doit appeler l'API réelle) ; fixtures issues de `docs/reference/api-adresse.sample.json`.
- Schéma Zod minimal d'une feature `address` (les autres champs en `.optional()` avec passthrough) :

```ts
import { z } from "zod";

export const GeocodeFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]), // [lon, lat]
  }),
  properties: z
    .object({
      label: z.string(),
      score: z.number(),
      id: z.string(),
      type: z.enum(["housenumber", "street", "locality", "municipality"]),
      name: z.string(),
      postcode: z.string(),
      citycode: z.string(),
      city: z.string(),
      district: z.string().optional(),
      depcode: z.string().optional(),
      banId: z.string().nullable().optional(),
      housenumber: z.string().optional(),
      street: z.string().optional(),
      municipality: z.string().optional(),
      population: z.number().optional(),
      oldcitycode: z.string().nullable().optional(),
      oldcity: z.string().nullable().optional(),
      context: z.string().optional(),
      importance: z.number().optional(),
      distance: z.number().optional(),
      x: z.number().optional(), // Lambert-93, never use as lon/lat
      y: z.number().optional(),
      _type: z.literal("address"),
    })
    .passthrough(),
});

export const GeocodeSearchResponseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(GeocodeFeatureSchema),
  query: z.string().optional(), // absent on /reverse
});

export const GeocodeErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  detail: z.array(z.string()),
});
```

- Ne pas utiliser `x` / `y`, ni `/completion`, ni l'ancien hôte.

## 11. Mapping vers notre schéma

Référence : brief §4. Le géocodeur sert d'abord au profil (onboarding, étape 4). Les autres tables sont mentionnées pour mémoire.

### 11.1 Table `profiles`

| Colonne | Source dans la réponse `/search` | Règle |
|---|---|---|
| `location_label` | `properties.label` | Libellé affiché à l'étudiant et stocké tel quel (`10 Rue de Rivoli 75004 Paris`, `Lyon`). Pour une commune obtenue par `/reverse`, préférer `properties.city` (label composite). |
| `location_lat` | `geometry.coordinates[1]` | Latitude WGS84. Jamais `properties.y`. |
| `location_lng` | `geometry.coordinates[0]` | Longitude WGS84. Jamais `properties.x`. |
| `insee_code` | `properties.citycode` | Code INSEE tel que renvoyé (arrondissement à Paris / Lyon / Marseille, commune actuelle pour une commune nouvelle). Dérivation vers la commune parente côté serveur si un usage l'exige (§6). |
| `search_radius_km` | (saisie utilisateur) | Transmis à l'API Alternance comme `radius` (0 à 200, défaut 30) avec `latitude` / `longitude` ci-dessus. |

Champs utiles non stockés au MVP mais disponibles : `properties.postcode`, `properties.city`, `properties.district`, `properties.type` (permet de distinguer une ville d'une adresse précise pour l'affichage), `properties.score` (seuil de confiance possible avant validation).

### 11.2 Table `offers`

Les offres proviennent de l'API Alternance, qui fournit ses propres données de localisation (voir `docs/API_ALTERNANCE.md`). Le géocodeur n'intervient que si une offre arrive sans coordonnées mais avec une adresse ou une commune ; ce cas, s'il existe, est à confirmer (voir §12). Le cas échéant :

| Colonne | Source | Règle |
|---|---|---|
| `location_label` | `properties.label` | |
| `lat`, `lng` | `geometry.coordinates[1]`, `geometry.coordinates[0]` | |
| `insee_code` | `properties.citycode` | Même convention que `profiles.insee_code` pour que les comparaisons soient cohérentes. |

### 11.3 Table `companies`

`address`, `postal_code` et `city` viennent de l'API Recherche d'entreprises (`docs/API_RECHERCHE_ENTREPRISES.md`). Aucun appel au géocodeur n'est prévu pour cette table au MVP. Si un calcul de distance siège / étudiant devenait nécessaire, géocoder `address + postal_code + city` avec `autocomplete=0` et `postcode=<postal_code>` en filtre.

### 11.4 Job `compute-matches`

Le score de distance (brief §6) se calcule entre `profiles.location_lat` / `location_lng` et `offers.lat` / `lng` (toutes en WGS84), jamais à partir de `x` / `y` ni de codes INSEE.

## 12. Points restant à vérifier

1. Le billet d'origine `https://adresse.data.gouv.fr/blog/lapi-adresse-de-la-base-adresse-nationale-est-transferee-a-lign` était en HTTP 503 (« IGN-MUT : 503 ») pendant toute la vérification ; seule sa copie sur data.gouv.fr (3 avril 2025) a été lue. Vérifier plus tard s'il contient des précisions postérieures, notamment la date réelle d'arrêt de l'ancien hôte.
2. L'arrêt de la redirection annoncé pour le 14 avril 2026 n'est pas effectif le 9 septembre 2026 (`api-adresse.data.gouv.fr` répond encore 200). Aucune source ne dit jusqu'à quand.
3. Signification exacte de l'en-tête `x-ratelimit-limit-second: 1` ; comportement réel du 429 (corps, en-têtes) non testé pour ne pas déclencher le blocage.
4. Bornes complètes des codes INSEE d'arrondissement (`75101` à `75120`, `69381` à `69389`, `13201` à `13216`) : confirmer avec la nomenclature INSEE ou avec `GET /geographie/v1/commune/search?code=75056` de l'API Alternance (clé requise).
5. Valeurs de debounce et de `limit` pour l'autocomplétion (300 ms, 3 caractères, `limit=5`) : hypothèse projet à valider par l'owner, aucune recommandation officielle.
6. Architecture d'appel : route handler `/api/geocode` (règle `CLAUDE.md`) ou appel navigateur direct (CORS ouvert, quota par IP réparti) ; à trancher dans `docs/QUESTIONS.md`, ainsi que l'écart d'URL avec le brief §5.1.
7. Version exacte du géocodeur déployée en production : le dépôt public (`main`, tag `3.1.4`) borne `limit` à 20 alors que la production accepte 50 ; se fier à l'OpenAPI en ligne et aux tests, pas au dépôt.
8. Fréquence de mise à jour de l'index adresses : « deux fois par semaine » (adresse.data.gouv.fr) contre « chaque semaine » (guide cartes.gouv.fr). Écrire « au moins hebdomadaire ».
9. HTTP 500 corps vide sur un mot unique très long : comportement non documenté, à surveiller ; prévoir troncature côté client et message générique.
10. Aucune clause de cache ou de conservation des résultats n'a été identifiée dans les sources consultées ; confirmer dans les CGU cartes.gouv.fr avant de mettre en place un cache long.
11. Besoin réel de géocoder les offres (`offers.lat`, `lng`, `insee_code`) : dépend des champs de localisation fournis par l'API Alternance, à confirmer dans `docs/API_ALTERNANCE.md`.

## 13. Sources

Documentation et actualités officielles :

- `https://adresse.data.gouv.fr/outils/api-doc/adresse` (dépréciation, quota 50 req/s/IP, 429, `retry-after`, fréquence de mise à jour)
- `https://www.data.gouv.fr/posts/lapi-adresse-de-la-base-adresse-nationale-est-transferee-a-lign-10` (billet du 3 avril 2025, copie)
- `https://adresse.data.gouv.fr/blog/lapi-adresse-de-la-base-adresse-nationale-est-transferee-a-lign` (billet d'origine, HTTP 503 pendant la vérification)
- `https://cartes.gouv.fr/actualites/fin-de-la-redirection-de-lapi-ban` (23 mars 2026)
- `https://cartes.gouv.fr/actualites/fermeture-du-site-geoservices-le-26-mars-poursuivez-vos-usages-sur-cartesgouvfr` (18 mars 2026)
- `https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/` (guide géocodage)
- `https://raw.githubusercontent.com/IGNF/cartes.gouv.fr-documentation/main/content/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/autocompletion.md` (guide autocomplétion)
- `https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage` et `https://geoservices.ign.fr/services-geoplateforme-geocodage-autocompletion` (redirigées vers cartes.gouv.fr)
- `https://www.data.gouv.fr/dataservices/api-geoplateforme-geocodage` (fiche du service)
- `https://www.data.gouv.fr/datasets/base-adresse-nationale/` (jeu de données BAN)
- `https://demarche.numerique.gouv.fr/fermeture/demande-de-levee-de-limite-de-l-api-base-adresse` (démarche close le 5 janvier 2026)
- `https://geoservices.ign.fr/contact` (redirigée vers `https://cartes.gouv.fr/aide/fr/nous-ecrire/`)
- `https://fab-geocommuns.github.io/carte-facile-site/fr/documentation/aller-plus-loin/api-adresse/` (carte-facile)

Licences et CGU :

- `https://cartes.gouv.fr/cgu` (CGU Géoplateforme, version du 15 octobre 2024)
- `https://www.data.gouv.fr/pages/legal/licences/etalab-2.0/` (Licence Ouverte 2.0)
- `https://www.etalab.gouv.fr/licence-ouverte-open-licence` (URL citée dans l'OpenAPI)

Spécifications et code source :

- `https://data.geopf.fr/geocodage/openapi.yaml` (copie : `docs/reference/geopf-geocodage.openapi.yaml`)
- `https://data.geopf.fr/geocodage/getCapabilities` (copie : `docs/reference/geopf-geocodage.getcapabilities.json`)
- `https://raw.githubusercontent.com/Geoplateforme/gpf-geocodeur/main/api/params/base.js`
- `https://raw.githubusercontent.com/Geoplateforme/gpf-geocodeur/refs/tags/3.1.4/api/params/base.js`
- `https://raw.githubusercontent.com/Geoplateforme/gpf-geocodeur/main/api/index.js`
- `https://raw.githubusercontent.com/Geoplateforme/gpf-geocodeur/main/docs/architecture.md`
- `https://api.apprentissage.beta.gouv.fr/fr/documentation-technique` (copie : `docs/reference/api-alternance.openapi.json`)

Requêtes réelles exécutées le 9 septembre 2026 (réponses dans `docs/reference/api-adresse.sample.json`) :

- `https://data.geopf.fr/geocodage/search?q=8%20bd%20du%20port&limit=3`
- `https://data.geopf.fr/geocodage/search?q=8%20bd%20du%20port&lat=49.03&lon=2.06&limit=1`
- `https://data.geopf.fr/geocodage/search?q=10%20rue%20de%20rivoli%20paris&limit=1`
- `https://data.geopf.fr/geocodage/search?q=10%20rue%20de%20rivoli&citycode=75104&limit=2`
- `https://data.geopf.fr/geocodage/search?q=10%20rue%20de%20rivoli&citycode=75056&limit=2`
- `https://data.geopf.fr/geocodage/search?q=20%20rue%20de%20la%20republique%20lyon&limit=2`
- `https://data.geopf.fr/geocodage/search?q=1%20la%20canebiere%20marseille&limit=2`
- `https://data.geopf.fr/geocodage/search?q=1%20rue%20de%20la%20gare%20cran-gevrier&limit=2`
- `https://data.geopf.fr/geocodage/search?q=paris&type=municipality&limit=3`
- `https://data.geopf.fr/geocodage/search?q=lyon&type=municipality&limit=3`
- `https://data.geopf.fr/geocodage/search?q=marseille&type=municipality&limit=3`
- `https://data.geopf.fr/geocodage/search?q=paris&type=street,municipality&limit=3`
- `https://data.geopf.fr/geocodage/search?q=gare%20de%20lyon&index=poi&limit=1`
- `https://data.geopf.fr/geocodage/search?q=rue%20de%20la%20paix` et `…&limit=51`
- `https://data.geopf.fr/geocodage/search?q=ab`, `…?q=paris&type=foo`, `…/search` (sans `q`), `…?q=zzzzqqqqxxxx&limit=1`
- `https://data.geopf.fr/geocodage/search?q=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` (HTTP 500)
- `https://data.geopf.fr/geocodage/reverse?lon=2.37&lat=48.357`, `…?lon=2.37`, `…?lon=2.37&lat=abc`
- `https://data.geopf.fr/geocodage/reverse?lon=2.36041&lat=48.8555&limit=2` et `…&type=municipality`
- `https://data.geopf.fr/geocodage/reverse?lon=4.835&lat=45.758&type=municipality`
- `https://data.geopf.fr/geocodage/completion?text=10%20rue%20de%20rivoli%20paris&type=StreetAddress&maximumResponses=1`
- `https://api-adresse.data.gouv.fr/search/?q=8%20bd%20du%20port&limit=3` et `https://api-adresse.data.gouv.fr/` (en-têtes de dépréciation)
