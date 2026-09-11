# Codes ROME : nomenclature officielle, sources de données et validation

Dernière vérification : 9 septembre 2026

Ce document décrit le Répertoire Opérationnel des Métiers et des Emplois (ROME 4.0) tel que le projet l'utilise : format des codes, fichiers open data de France Travail, API optionnelle « ROME 4.0 - Métiers », comportement du paramètre `romes` de l'API Alternance, licence, pièges et mapping vers le schéma du brief (`docs/BRIEF.md`, section 4). Les affirmations proviennent des fichiers réellement téléchargés le 9 septembre 2026 et copiés dans `docs/reference/rome/`, de la spécification OpenAPI locale de l'API Alternance (`docs/reference/api-alternance.openapi.json`, version `a18de31`), du code source public de La bonne alternance et des pages CMS de francetravail.io. Toute affirmation non confirmée par une source primaire porte le marqueur « ⚠️ Non vérifié ».

## Résumé en 5 points

1. **Format** : un code ROME est une lettre majuscule (A à N) suivie de quatre chiffres, regex `^[A-Z]\d{4}$` (exemple `M1805`, Développeur / Développeuse informatique). C'est exactement le format validé par l'API Alternance et par La bonne alternance. Les appellations (14 301 intitulés d'emploi) ont un identifiant entier `code_ogr` qui n'est **jamais** accepté par l'API Alternance.
2. **Version courante** : ROME 4.0 version 61 « 26M06 », publiée le 15/06/2026 : 1 911 fiches métier, 14 301 appellations, 14 grands domaines, 110 domaines professionnels. Rythme annoncé : 2 versions par an, prochaine en octobre 2026. Les libellés et le périmètre d'un code peuvent changer entre versions.
3. **Source retenue** : l'export CSV UTF-8 de France Travail (`GET https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/csv`, zip de 4,5 Mo, sans clé) chargé dans Postgres (tables `rome_codes` et `rome_appellations`). Licence Ouverte : usage commercial autorisé, seule obligation la mention « Source : France Travail (ex Pôle emploi), ROME 4.0 version 61 du 15/06/2026 ». Ne pas utiliser l'export JSON (ISO-8859-15, `code_rome` absent des appellations).
4. **API** : l'API Alternance n'expose aucune route métiers ou ROME ; son paramètre `romes` est une chaîne de codes séparés par des virgules. L'ancienne API `/api/v1/metiers/*` de La bonne alternance a été supprimée le 26/08/2026. L'API France Travail « ROME 4.0 - Métiers » (OAuth2 client credentials, gratuite) existe mais n'apporte rien d'indispensable face au fichier local : elle n'est pas utilisée au MVP.
5. **Garde-fou LLM** : à l'étape 3 de l'onboarding, la recherche plein texte Postgres sur les appellations fournit 20 à 40 codes candidats ; Haiku choisit uniquement parmi ces candidats ; Zod vérifie le format et l'appartenance à la liste ; les libellés affichés viennent toujours de la table, jamais du modèle. L'invention d'un code devient impossible par construction.

## 1. Ce que le projet attend du ROME

Rappel du brief (`docs/BRIEF.md`) :

| Besoin | Où | Ce que le ROME doit fournir |
|---|---|---|
| Étape 3 de l'onboarding (§5.1) | `profiles.domain_free_text` puis `profiles.rome_codes text[]` (2 à 5 codes) | Une liste de codes valides avec leur libellé officiel, proposée par Haiku à partir du texte libre, que l'étudiant coche ou ajuste |
| Recherche d'offres (§3.1, §6 `sync-offers`) | Paramètre `romes` de `GET /job/v1/search` | Des codes au format exact attendu par l'API Alternance |
| Cache des offres (§4 `offers.rome_codes text[]`) | Réponse `jobs[].offer.rome_codes` | Des codes du même format, pour la correspondance avec le profil |
| Score de matching (§6 `compute-matches`) | `matches.score_reasons` | La « correspondance ROME » entre `profiles.rome_codes` et `offers.rome_codes` |
| Affichage | Écrans d'onboarding et détail d'offre | Le libellé officiel d'un code, à jour de la version courante |

## 2. La nomenclature ROME 4.0

### 2.1 Format des codes

- Un code ROME est composé de **5 caractères** : une lettre majuscule de A à N puis quatre chiffres. Regex de validation interne : `^[A-Z]\d{4}$`.
- Vérifié sur l'export officiel version 61 (`unix_referentiel_code_rome_v461_utf8.csv`) : 1 911 codes, 1 911 valeurs distinctes, 0 code hors du motif, lettres présentes A B C D E F G H I J K L M N, minimum `A1101`, maximum `N4406`.
- L'API Alternance utilise le même motif pour `jobs[].offer.rome_codes` (`pattern: ^[A-Z]\d{4}$`) et La bonne alternance valide le paramètre `romes` avec `CODE_ROME_REGEX = ^[A-Z]\d{4}$` (voir section 5).
- Piège : dans la spécification de l'API Alternance, le schéma `Certification.domaines.rome.rncp[].code` (données France Compétences) utilise un motif plus lâche `^[A-Z]{1}\d{0,4}$`. Pour la validation interne, retenir le motif strict.

Schéma Zod à utiliser dans `lib` :

```ts
import { z } from "zod";

export const RomeCodeSchema = z.string().regex(/^[A-Z]\d{4}$/, {
  error: "Code ROME invalide (format attendu : une lettre et quatre chiffres, ex. M1805)",
});
export type RomeCode = z.infer<typeof RomeCodeSchema>;
```

### 2.2 Hiérarchie

Le code porte sa hiérarchie (fichier `unix_cr_gd_dp_v461_utf8.csv`, colonnes `code_rome, libelle_rome, code_grand_domaine, libelle_grand_domaine, code_domaine_professionel, libelle_domaine_professionel` ; noter la faute d'orthographe `professionel` dans les en-têtes de ce fichier, à reprendre telle quelle dans le parseur) :

| Niveau | Caractères | Nombre (v61) | Exemple |
|---|---|---|---|
| Grand domaine | 1er caractère | 14 | `M` Support à l'entreprise |
| Domaine professionnel | 3 premiers caractères | 110 | `M18` Systèmes d'information et de télécommunication |
| Fiche métier (code ROME) | 5 caractères | 1 911 | `M1805` Développeur / Développeuse informatique |

Les 14 grands domaines (fichier `unix_grand_domaine_v461_utf8.csv`) :

| Code | Libellé |
|---|---|
| A | Agriculture et Pêche, Espaces naturels et Espaces verts, Soins aux animaux |
| B | Arts et Façonnage d'ouvrages d'art |
| C | Banque, Assurance, Immobilier |
| D | Commerce, Vente et Grande distribution |
| E | Communication, Média et Multimédia |
| F | Construction, Bâtiment et Travaux publics |
| G | Hôtellerie-Restauration, Tourisme, Loisirs et Animation |
| H | Industrie |
| I | Installation et Maintenance |
| J | Santé |
| K | Services à la personne et à la collectivité |
| L | Spectacle |
| M | Support à l'entreprise |
| N | Transport et Logistique |

### 2.3 Fiches métier et appellations

- **Fiche métier** : un code ROME et son libellé `libelle_rome` (max 107 caractères). Identifiants techniques associés : `code_fiche_metier` et `code_ogr` (entiers).
- **Appellation** : un intitulé d'emploi rattaché à une fiche. Identifiée par `code_ogr` (entier, 14 301 valeurs distinctes, aucune duplication), avec `libelle_appellation_long` (max 137 caractères), `libelle_appellation_court`, le `code_rome` de rattachement, `classification` = `PRINCIPALE` (exactement 1 911, une par fiche) ou `SYNONYME` (12 390), et `peu_usite` = `O` ou `N` (467 appellations `O`, 13 834 `N` ; une appellation `peu_usite = O` n'apparaît pas dans la fiche publiée).
- Répartition : 1 à 119 appellations par fiche, moyenne 7,5 ; toutes les fiches ont au moins une appellation ; tous les `code_rome` du fichier appellations existent dans le fichier codes (0 orphelin).
- Les appellations n'ont **pas** de code au format ROME. L'API Alternance n'accepte que des codes ROME à 5 caractères, jamais des `code_ogr`.

Exemple réel pour `M1805` :

| code_ogr | libelle_appellation_long | classification |
|---|---|---|
| 14153 | Développeur / Développeuse informatique | PRINCIPALE |
| 10944 | Analyste développeur / Analyste développeuse | SYNONYME |
| 15569 | Informaticien / Informaticienne de développement | SYNONYME |

Illustration de la granularité « emploi » du ROME 4.0, fiches « développeur » présentes en v61 : `M1434` Développeur / Développeuse d'audience, `M1805` Développeur / Développeuse informatique, `M1824` Développeur / Développeuse décisionnel - Business Intelligence, `M1831` Développeur / Développeuse - jeux vidéo, `M1837` Développeur / Développeuse multimédia, `M1855` Développeur / Développeuse web, `M1861` Développeur / Développeuse logiciel ou d'application, `M1877` Développeur / Développeuse blockchain. Une recherche « développeur web » devrait donc proposer `M1855` en premier, avec `M1805` et `M1861` comme codes voisins.

### 2.4 Version courante et rythme de mise à jour

Contenu de `version.txt` (dans le zip officiel, copie dans `docs/reference/rome/rome-version-61-version.txt`) :

| Champ | Valeur |
|---|---|
| Numero de version | 61 |
| Date de publication | 15/06/2026 |
| Date de validation | 27/04/2026 |
| Titre/commentaire | ROME 4.0 version 61 - 26M06 |
| Description | 351 nouvelles fiches métier, 166 fiches issues du V3 enrichies, 280 fiches du V4 améliorées ; « Le ROME passe ainsi à 1911 fiches métier » ; « dans une logique de 2 versions par an » |

- Chiffres v61 sur francetravail.org : 1 911 fiches, 14 301 appellations, 21 320 savoir-faire, 16 savoir-être professionnels, 2 269 compétences socio-comportementales, 17 319 savoirs, 191 contextes de travail.
- data.gouv.fr : « Depuis mars 2023, le ROME V3 est devenu le ROME 4.0 : Mis à jour au moins deux fois par an » et « Prochaine actualisation prévue du ROME en octobre 2026 ». Le champ `frequency` de la fiche vaut `punctual` (métadonnée non représentative) ; `last_modified` = `2026-06-18T07:30:44Z`.
- Dates de mise en ligne différentes selon les canaux : 15/06/2026 dans `version.txt`, « Publié le 16/06/2026 » sur francetravail.org, 18/06/2026 sur data.gouv.fr. Se référer à `version.txt`.
- Incohérence interne de `version.txt` : l'introduction parle de « plus de 327 fiches » alors que le détail annonce « 351 nouvelles fiches métier ». Sans incidence pour l'import.
- Nouveautés de structure en v61 : fichier **ChangeLog** (`260609-changelogv60-v61.xlsx`) listant renommages, ré-indexations, créations, suppressions, substitutions et réactivations ; mécanisme de **substitution** (un objet obsolète est remplacé par un autre de sens proche ; concerne appellations, macro-compétences, compétences, savoirs, contextes de travail) ; suppression du tag « émergent(e) ». Une API « ROME 4.0 - Substitutions d'entités » est le service dédié à cette mécanique (section 4.8).
- Exemples de changements v60 vers v61 : `M1819` « Ingénieur / Ingénieure sécurité informatique » devient « Technicien / Technicienne en cybersécurité », ses appellations sont déplacées vers `M1856` ; `M1854` « Administrateur / Administratrice réseau informatique » devient « Chef / Cheffe de projet réseau fixe et mobile », appellations déplacées vers `M1802`. Conséquence : **un code peut changer de sens entre deux versions**. Stocker la version ROME utilisée et réafficher les libellés depuis la table locale plutôt que de les figer dans le profil.

### 2.5 ROME V3 et ROME 4.0, colonne `code_rome_parent`

- data.gouv.fr : « L'arborescence principale des métiers du ROME et la codification des fiches ROME ne changent pas pendant toute la durée de production en masse de nouvelles fiches. La mise en place d'une nouvelle arborescence est en cours d'instruction. » Le format de code est donc identique entre V3 et 4.0.
- `ROME_Presentation.pdf` (France Travail) : le V3 comptait « 532 fiches métiers actuelles » ; le 4.0 crée « de nouvelles fiches plus précises, à la maille "Emploi" (cible d'ici 18 à 24 mois : 3000 fiches) » adossées à l'arborescence existante ; les compétences 4.0 ont remplacé celles du V3 « automatiquement en mars 23 ».
- La colonne `code_rome_parent` (« Identifiant fonctionnel du métier dont peut dériver/hériter le métier », documentation technique §2.16) porte cette filiation : dans la v61, 1 379 codes sur 1 911 ont un parent différent d'eux-mêmes et il existe exactement **532 parents distincts**, soit le nombre de fiches V3. Exemples : `A1102` (parent `A1101`), `A1206` Concepteur / Conceptrice paysagiste (parent `F1101`), `M1855` Développeur / Développeuse web (parent `M1805`).
- Sur une appellation, `code_rome_parent` est le code ROME d'origine de l'appellation si elle existait avant la version Iota (09/2023), sinon le code parent du métier de rattachement.

### 2.6 Tags

Valeurs observées dans la v61 :

| Colonne | Valeurs | Remarque |
|---|---|---|
| `transition_eco` | `Emploi stratégique pour la Transition écologique`, `Emploi Vert`, `Emploi Blanc`, `Emploi Brun` | Peut être vide sur les appellations |
| `transition_num`, `transition_demo`, `emploi_reglemente`, `emploi_cadre` | `""`, `O`, `N` | Chaîne vide = non renseigné |
| `origine` (appellations) | vide dans la v61 | Valeurs possibles selon la doc : Cléa, Cléa management, PIX, PIX emploi, RECTEC |

## 3. Source retenue : export open data France Travail

### 3.1 Jeu de données data.gouv.fr

| Élément | Valeur |
|---|---|
| Page | `https://www.data.gouv.fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome` |
| API (métadonnées) | `https://www.data.gouv.fr/api/1/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome/` |
| Identifiant | `58da857388ee384902e505f5` |
| Organisation | France Travail |
| Licence | `fr-lo` (Licence Ouverte / Open Licence) |
| Créé le | 2017-03-28 |
| `last_modified` | `2026-06-18T07:30:44Z` |
| Ressources | 18 (les `filesize` sont `null` dans l'API ; tailles mesurées par téléchargement) |

Ressources (titre data.gouv, format, URL) :

| Ressource | Format | URL |
|---|---|---|
| Toutes les données du ROME | csv (zip) | `https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/csv` |
| Toutes les données du ROME | json (zip) | `https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/json` |
| Toutes les données du ROME | xml (zip) | `https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/xml` |
| Fiches métiers | pdf | `https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/pdf` |
| Arborescence principale | xlsx | `https://www.francetravail.org/files/live/sites/peorg/files/documents/Statistiques-et-analyses/Open-data/ROME/rome-arborescence-principale-juin-2026.xlsx` |
| Arborescence centres d'intérêt | xlsx | `.../ROME/rome-arborescence-des-centres-d-interet-juin-2026.xlsx` |
| Arborescence secteurs d'activité | xlsx | `.../ROME/rome-arborescence-des-secteurs-d-activite-juin-2026.xlsx` |
| Arborescence des compétences | xlsx | `.../ROME/rome-arborescence-des-competences-juin-2026.xlsx` |
| Arborescence simplifiée des compétences | xlsx | `.../ROME/260611-arborescence-simplifiee-des-competences.xlsx` |
| Arborescence des savoirs | xlsx | `.../ROME/rome-arborescence-des-savoirs-juin-2026.xlsx` |
| Arborescence des contextes de travail | xlsx | `.../ROME/rome-arborescence-des-contextes-de-travail-juin-2026.xlsx` |
| Tags de fiches métier | xlsx | `.../ROME/250528-fiches-rome-26m06-tag-pour-diffusion.xlsx` |
| Table ROME/NAF | xlsx | `.../ROME/rome-arborescence-des-secteurs-naf-juin-2026.xlsx` |
| Table ROME/Formacode V14 | xlsx | `.../ROME/260609-ref-formacode-v14-rome-26m06-v61-open-data.xlsx` |
| FAP / PCS / ROME | html (DARES) | `https://dares.travail-emploi.gouv.fr/donnees/la-nomenclature-des-familles-professionnelles-2021` |
| CHANGELOG (v60 vers v61) | xlsx | `.../ROME/260609-changelogv60-v61.xlsx` |
| Documentation technique (schémas) | pdf | `.../ROME/open-data-v3.0.pdf` |
| Engagements de service | pdf | `.../ROME/engagements_pe_rome.pdf` |

(`.../ROME/` abrège `https://www.francetravail.org/files/live/sites/peorg/files/documents/Statistiques-et-analyses/Open-data/ROME/`.)

URL stables data.gouv (répondent **302** vers les URL France Travail) :

| URL stable | Cible |
|---|---|
| `https://www.data.gouv.fr/api/1/datasets/r/8cf674b6-ef21-446a-8190-178e2defd6fc` | export csv |
| `https://www.data.gouv.fr/api/1/datasets/r/1c893376-8476-4262-9a0e-8df519883e1e` | export json |
| `https://www.data.gouv.fr/api/1/datasets/r/88342be1-06b8-4ab6-8ce9-83e117d21346` | xlsx arborescence principale |

Le classeur `rome-arborescence-principale-juin-2026.xlsx` (611 226 octets) contient une feuille « Définition » (« Classification du ROME en 14 grands domaines, 110 domaines professionnels, 1911 fiches ROME avec leurs 14301 appellations de métiers » ; « Code OGR : Code interne correspondant aux appellations ») et une feuille « Arbo Principale 15-06-2026 » de 16 338 lignes. Il n'est pas nécessaire à l'import : les CSV contiennent les mêmes données.

### 3.2 Endpoints de téléchargement

Base : `https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/`. Aucune authentification, aucune clé, aucun paramètre.

| Méthode | Chemin | Réponse | Taille (09/09/2026) | Contenu |
|---|---|---|---|---|
| GET | `/csv` | 200, `Content-Type: application/zip`, `Content-Disposition: attachment; filename=RefRomeCsv.zip` | 4 528 555 octets | 30 fichiers datés du 13/06/2026, 28 293 893 octets décompressés |
| GET | `/json` | 200, zip | 5 492 023 octets | 13 fichiers, 44 939 376 octets décompressés |
| GET | `/xml` | 200, zip `RefRomeXml.zip` | 6 076 556 octets | 13 fichiers `*_iso8859-15.xml`, 64 079 869 octets décompressés, datés du 13/06/2026, même `version.txt` |
| GET | `/pdf` | fiches métiers en PDF | non mesuré | non utilisé |

Particularités vérifiées :

- Les requêtes **HEAD renvoient 404** (JSON d'erreur) ; seule la méthode GET fonctionne.
- La réponse GET ne contient **ni `Last-Modified` ni `ETag`** : la détection d'une nouvelle version passe par `version.txt` (dans le zip) ou par `last_modified` de l'API data.gouv (section 3.7).
- Les réponses posent un cookie `TS01f539db` (F5) ; sans incidence, ne pas le persister.
- Aucun quota ni limite documentés sur ces endpoints ; les engagements de service (section 3.8) autorisent explicitement le téléchargement automatisé.

Exemple :

```bash
curl -L -o RefRomeCsv.zip \
  -A "candidatly/0.1 (contact@candidatly.example)" \
  "https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/csv"
unzip -l RefRomeCsv.zip | grep -E "referentiel_code_rome|referentiel_appellation|grand_domaine|domaine_professionnel|cr_gd_dp|version.txt"
```

### 3.3 Contenu de l'archive CSV

Fichiers utiles au projet (préfixe `unix_`, suffixe `_v461_utf8.csv`, `461` = version 61) :

| Fichier | Taille | Usage |
|---|---|---|
| `unix_referentiel_code_rome_v461_utf8.csv` | 218 837 o | Table `rome_codes` |
| `unix_referentiel_appellation_v461_utf8.csv` | 2 485 668 o | Table `rome_appellations` |
| `unix_grand_domaine_v461_utf8.csv` | 597 o | Table `rome_grand_domaines` |
| `unix_domaine_professionnel_v461_utf8.csv` | 4 190 o | Table `rome_domaines_professionnels` |
| `unix_cr_gd_dp_v461_utf8.csv` | 252 590 o | Jointure code / domaine / grand domaine (redondant avec les 3 premiers caractères du code) |
| `unix_texte_v461_utf8.csv` | 2 191 363 o | Définitions et accès métier (optionnel, pour afficher une description à l'étudiant) |
| `unix_rubrique_mobilite_v461_utf8.csv` | non mesuré | Mobilités entre métiers (optionnel) |
| `version.txt` | 11 814 o | Numéro et dates de version |

Autres fichiers de l'archive, non utilisés : compétences, savoirs, contextes de travail, NAF, secteurs, centres d'intérêt, RIASEC, formacode.

Format : **UTF-8**, séparateur **virgule**, tous les champs entre guillemets doubles, première ligne = en-tête. Plusieurs libellés contiennent des virgules : un vrai parseur CSV est obligatoire (pas de `split(",")`).

### 3.4 Schéma des fichiers CSV (documentation technique v3.0 du 15/06/2026)

`unix_referentiel_code_rome_v461_utf8.csv` :

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `code_rome` | string(5) | `^[A-Z]\d{4}$`, unique | Code ROME |
| `code_fiche_metier` | entier (chaîne) | | Identifiant technique de la fiche |
| `code_ogr` | entier (chaîne) | | Identifiant OGR de la fiche |
| `libelle_rome` | string | max 107 caractères | Libellé officiel du métier |
| `transition_eco` | string | voir 2.6 | Tag transition écologique |
| `transition_num` | `""`, `O`, `N` | | Tag transition numérique |
| `transition_demo` | `""`, `O`, `N` | | Tag transition démographique |
| `emploi_reglemente` | `""`, `O`, `N` | | Emploi réglementé |
| `emploi_cadre` | `""`, `O`, `N` | | Emploi cadre |
| `code_rome_parent` | string(5) | code ROME existant | Métier dont dérive la fiche (voir 2.5) |

`unix_referentiel_appellation_v461_utf8.csv` :

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `code_ogr` | entier (chaîne) | unique | Identifiant de l'appellation |
| `libelle_appellation_long` | string | max 137 caractères | Libellé long |
| `libelle_appellation_court` | string | | Libellé court |
| `code_rome` | string(5) | référence `referentiel_code_rome.code_rome` | Fiche de rattachement |
| `transition_eco` | string | | Tag (peut être vide) |
| `transition_num` | `""`, `O`, `N` | | |
| `transition_demo` | `""`, `O`, `N` | | |
| `emploi_reglemente` | `""`, `O`, `N` | | |
| `emploi_cadre` | `""`, `O`, `N` | | |
| `classification` | `PRINCIPALE` ou `SYNONYME` | exactement une `PRINCIPALE` par fiche | |
| `origine` | string | vide en v61 | Cléa, Cléa management, PIX, PIX emploi, RECTEC |
| `code_rome_parent` | string(5) | | Voir 2.5 |
| `peu_usite` | `O` ou `N` | | `O` : absente de la fiche publiée |

`unix_grand_domaine_v461_utf8.csv` : `code_grand_domaine` (1 caractère), `libelle_grand_domaine`.

`unix_domaine_professionnel_v461_utf8.csv` : `code_domaine_professionnel` (3 caractères), `libelle_domaine_professionnel`.

`unix_cr_gd_dp_v461_utf8.csv` : `code_rome`, `libelle_rome`, `code_grand_domaine`, `libelle_grand_domaine`, `code_domaine_professionel`, `libelle_domaine_professionel` (orthographe de l'en-tête telle quelle).

`unix_texte_v461_utf8.csv` : `code_rome`, `code_compo_bloc`, `libelle_type_texte` (`definition`, `acces_metier`, ...), `position_phrase`, `libelle_texte` (une ligne par phrase).

`version.txt` : 5 parties (Numero de version, Date de publication, Date de validation, Titre/commentaire, Description), encodé en UTF-8, lignes `Cle : valeur`.

Historique de structure (documentation technique) : 1.5 (20/11/2023, ROME 4.0 v9) ajout des tags transition démographique, emploi cadre, emploi réglementé et code ROME parent ; 1.7 (05/01/2024) ajout des fichiers NAF et du champ `origine` ; 1.9 (26/09/2024) ajout de `code_rome_parent` et `peu_usite` dans les exports appellations ; 2.0 (04/09/2025) schémas CSV/XML/JSON en annexe ; **3.0 (15/06/2026, 26M06) : « Pas d'évolution de structure de données des livrables CSV, XML et JSON »**. Le parseur doit néanmoins lire l'en-tête et échouer explicitement si une colonne attendue manque.

### 3.5 Exemples réels (extraits des fichiers v61)

```csv
"code_rome","code_fiche_metier","code_ogr","libelle_rome","transition_eco","transition_num","transition_demo","emploi_reglemente","emploi_cadre","code_rome_parent"
"A1101","11","6","Conducteur / Conductrice d'engins agricoles","Emploi Blanc","","","","","A1101"
"M1805","567","494","Développeur / Développeuse informatique","Emploi Blanc","O","N","N","O","M1805"
"M1855","32865","489081","Développeur / Développeuse web","Emploi Blanc","O","N","N","N","M1805"
```

```csv
"code_ogr","libelle_appellation_long","libelle_appellation_court","code_rome","transition_eco","transition_num","transition_demo","emploi_reglemente","emploi_cadre","classification","origine","code_rome_parent","peu_usite"
"10200","Abatteur / Abatteuse de carrière","Abatteur / Abatteuse de carrière","F1402","Emploi Brun","","","O","","SYNONYME","","F1402","N"
"14153","Développeur / Développeuse informatique","Développeur / Développeuse informatique","M1805","Emploi Blanc","O","","","O","PRINCIPALE","","M1805","N"
"200151","Développeur / Développeuse back-end","Développeur / Développeuse back-end","M1855","Emploi Blanc","O","","","","SYNONYME","","M1805","N"
"488824","Devops","Devops","M1827","Emploi Blanc","O","","","O","SYNONYME","","M1805","O"
```

```csv
"code_rome","libelle_rome","code_grand_domaine","libelle_grand_domaine","code_domaine_professionel","libelle_domaine_professionel"
"M1805","Développeur / Développeuse informatique","M","Support à l'entreprise","M18","Systèmes d'information et de télécommunication"
```

### 3.6 Exports JSON et XML : pourquoi ils ne sont pas retenus

- **JSON** : 13 fichiers dont `unix_referentiel_code_rome_v461.json` (510 384 o, tableau de 1 911 objets), `unix_referentiel_appellation_v461.json` (5 411 695 o, 14 301 objets), `unix_arborescence_principale_v461.json` (213 083 o, objet `{arbo_principale:[{code_metier:"A", libelle, liste_domaine_prof:[{code_metier:"A11", libelle, liste_metier:[{code_ogr, code_rome, libelle}]}]}]}`), `unix_fiche_emploi_metier_v461.json` (22 205 105 o, fiches complètes avec `rome`, `appellations`, `definition`, `acces_metier`, `competences`...).
- Les fichiers JSON **ne sont pas en UTF-8** : encodage **ISO-8859-15** (vérifié : l'octet `0xBD` apparaît dans « Manœuvre », soit « œ » en Latin-9 et non « ½ » en Latin-1 ; aucun octet `0x80` à `0x9F`). Décoder avec `iconv -f ISO-8859-15` si ces fichiers sont un jour utilisés.
- Le JSON `referentiel_appellation` **ne contient pas le champ `code_rome`** (seulement `code_rome_parent`), contrairement au CSV.
- **XML** : mêmes données, ISO-8859-15, plus volumineux. Rien de plus que les CSV.

Conclusion : **utiliser exclusivement les CSV UTF-8**.

### 3.7 Détection d'une nouvelle version

```bash
curl -s "https://www.data.gouv.fr/api/1/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome/" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['last_modified'])"
# 2026-06-18T07:30:44Z
```

Réponse (extrait, champs utiles) :

```json
{
  "id": "58da857388ee384902e505f5",
  "title": "Répertoire Opérationnel des Métiers et des Emplois (ROME)",
  "license": "fr-lo",
  "frequency": "punctual",
  "last_modified": "2026-06-18T07:30:44Z",
  "organization": { "name": "France Travail" },
  "resources": [
    { "title": "Toutes les données du ROME", "format": "csv", "url": "https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/csv", "filesize": null }
  ]
}
```

Procédure : comparer `last_modified` à la valeur stockée ; si elle a changé, télécharger le zip, lire `version.txt` et importer seulement si `Numero de version` est supérieur à `max(rome_versions.version)`. Le ROME change au plus deux fois par an : un script `scripts/import-rome.ts` lancé manuellement, ou un job Trigger.dev mensuel qui ne fait que vérifier `last_modified` et alerte, suffit.

### 3.8 Engagements de service (PDF d'octobre 2019, encore au nom de Pôle emploi)

- Mise à jour « au minimum tous les 3 mois » ; version précédente maintenue en ligne 3 mois.
- Disponibilité mensuelle garantie de 99 % sur data.gouv.fr.
- « Téléchargement par un système de traitement automatisé » autorisé.
- Délai maximal de prise en compte des évolutions : 4 mois.
- Contact : `odsdsderomepole-emploi.00158@pole-emploi.fr`.

Ces engagements sont anciens (2019) et la Licence Ouverte précise que Pôle emploi « ne garantit pas non plus la fourniture continue de l'Information » (section 8.1) : conserver la dernière archive importée dans le dépôt ou dans un bucket pour ne dépendre d'aucune disponibilité au moment d'un déploiement.

## 4. API France Travail « ROME 4.0 - Métiers » (optionnelle, non utilisée au MVP)

Le portail francetravail.io est une application Angular : la page HTML est vide et le contenu est servi par `https://francetravail.io/api-peio/v2/pages/page?slug=produits-partages/catalogue/rome-4-0-metiers` (copie dans `docs/reference/rome/francetravail-io-rome-4-0-metiers.page.json` ; documentation API `rome-metiers` version 12.0, modifiée le 2025-09-30). L'ancien slug `data/api/rome-4-0-metiers` renvoie 301 vers ce nouveau slug.

### 4.1 Statut et accès

| Élément | Valeur |
|---|---|
| Accès | `accesType: "publique"`, `visibilite: "publique"` |
| Condition d'utilisation | `licence_ouverte` (« Licence ouverte », `contractualisation: false`) ; page « 3.2. Licence Etalab » : les API ROME 4.0 « Métiers, Contextes de travail, Fiches métiers, Substitutions d'entités » sont sous licence Etalab |
| Fiche technique | `scope: "nomenclatureRome"`, `royaume: "partenaire"`, `nombreAppelMax: 10`, `modeBacASable: false` |
| Présentation | « Mode d'accès public », « Fréquence de mise à jour temps réel », « Cinématique OAuth client credentials grant », « Royaume Pôle Emploi Access Management /partenaire », « Scopes nécessaires api_rome-metiersv1 nomenclatureRome » |

Texte de la page : « L'API ROME 4.0 - Métiers est en accès libre : utilisez-la librement en respectant les conditions mentionnées dans la licence Etalab, et en vous créant un compte sur francetravail.io. »

### 4.2 Obtention des identifiants

Documentation « Gérer mon compte et mes applications » :

1. Créer un compte sur francetravail.io (« Pensez à créer un compte avec une adresse mail accessible à l'ensemble de votre équipe de développement »).
2. Déclarer une application.
3. Souscrire aux API souhaitées. « Un identifiant client et une clé secrète vous sont délivrés par application ».

CGU francetravail.io (version du 1er janvier 2025) : les identifiants sont « strictement personnels et ne doivent en aucun cas être communiqués » ; **les identifiants d'une application sont désactivés après 12 mois consécutifs sans utilisation, avec un préavis de 15 jours** ; France Travail peut « refuser, suspendre ou supprimer l'accès à une application en cas de non-respect des CGU » ; conservation des données de compte jusqu'à 5 ans après la fin de l'accès.

Variables d'environnement prévues si l'API est un jour branchée (à ajouter dans `lib/env.ts` et `.env.example` uniquement à ce moment) : `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET`.

### 4.3 Authentification OAuth2 client credentials

| Élément | Valeur |
|---|---|
| Méthode et URL | `POST https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire` |
| En-tête | `Content-Type: application/x-www-form-urlencoded` |
| Corps | `grant_type=client_credentials&client_id=[identifiant client]&client_secret=[clé secrète]&scope=[scopes séparés par des espaces]` |
| Scope pour cette API | `api_rome-metiersv1 nomenclatureRome` |
| Réponse 200 | `{"access_token": "...", "token_type": "Bearer", "expires_in": 1499, "scope": "..."}` (1 499 s dans l'exemple de la doc) |
| Utilisation | `Authorization: Bearer [Access token]` sur chaque appel |

Paramètres du corps :

| Paramètre | Type | Requis | Valeur |
|---|---|---|---|
| `grant_type` | string | oui | `client_credentials` |
| `client_id` | string | oui | identifiant client de l'application |
| `client_secret` | string | oui | clé secrète de l'application |
| `scope` | string | oui | scopes séparés par des espaces, ex. `api_rome-metiersv1 nomenclatureRome` |

Erreurs vérifiées en direct :

| Cas | Réponse |
|---|---|
| Token sans identifiants | `HTTP 400 {"error":"invalid_client","error_description":"Client authentication failed"}` |
| GET non authentifié sur `https://api.francetravail.io/partenaire/rome-metiers/v1/metiers/metier` | `401` avec `Www-Authenticate: Bearer` |
| GET non authentifié sur un chemin inexistant sous `/partenaire/` | `401` également : le 401 est générique et ne prouve pas l'existence d'une route |
| Scope inconnu | `invalid_scope` (documentation « Erreurs fréquentes ») |

Exemple :

```bash
curl -s -X POST "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=$FRANCE_TRAVAIL_CLIENT_ID" \
  --data-urlencode "client_secret=$FRANCE_TRAVAIL_CLIENT_SECRET" \
  --data-urlencode "scope=api_rome-metiersv1 nomenclatureRome"
```

```json
{ "access_token": "eyJ...", "token_type": "Bearer", "expires_in": 1499, "scope": "api_rome-metiersv1 nomenclatureRome" }
```

### 4.4 Endpoints

Base : `https://api.francetravail.io/partenaire/rome-metiers/v1/metiers/`. Tous en GET, `Authorization: Bearer`. Paramètre optionnel commun `champs` (sélecteur de champs, `champs=field1,field2`). Réponses `200`, `400` (« peut-être causé par un sélecteur de champs incorrect »), `404` sur les lectures unitaires.

| Chemin | Rôle | Paramètres |
|---|---|---|
| `theme` / `theme/{code}` | Thèmes de métiers | `champs` |
| `metier` | Liste des métiers | `champs`, filtres optionnels `riasec-majeur`, `riasec-mineur`, `code-naf`, `code-competence` |
| `metier/{code}` | Un métier (code ROME) | `champs` |
| `grand-domaine` / `grand-domaine/{code}` | Grands domaines | `champs` |
| `domaine-professionnel` / `domaine-professionnel/{code}` | Domaines professionnels | `champs` |
| `appellation` | Liste complète des appellations (avec `metier` imbriqué) | `champs` |
| `appellation/{code}` | Une appellation (code OGR) | `champs` |
| `appellation/requete` | Recherche texte d'appellations | `q` (requis), `qf`, `fq`, `champs` |
| `centre-interet` / `centre-interet/{code}` | Centres d'intérêt | `champs` |
| `secteur-activite` / `secteur-activite/{code}` | Secteurs d'activité | `champs` |

Le filtre `code-naf` de `metier` est une piste pour relier le code NAF d'une entreprise (API Recherche d'entreprises, table `companies.naf_code`) à des métiers ROME ; hors MVP.

⚠️ Non vérifié : le swagger de l'API (`idFichierSwagger` 1687 dans le CMS) n'a pas pu être téléchargé sans compte ; les regex de validation côté France Travail (format exact du paramètre `code`, contraintes sur `q`) ne sont donc pas connues.

### 4.5 `GET appellation/requete`

Paramètres :

| Paramètre | Type | Requis | Description |
|---|---|---|---|
| `q` | string | oui | « Texte recherché en saisie libre sur le libellé de l'appellation » (le CMS décrit deux ressources identiques, l'une « sur le libellé du métier », l'autre « sur le libellé de l'appellation ») |
| `qf` | string | non | Index de recherche (query fields) |
| `fq` | string | non | Filtre, ex. `fq=code:1 AND (code:2 OR libelle:app)` |
| `champs` | string | non | Sélecteur de champs |

Réponse (`200`, objet nommé `RequeteAppellation` dans la doc, champs à la racine) :

| Champ | Type | Description |
|---|---|---|
| `totalResultats` | integer | Nombre d'appellations répondant aux critères (« 20 appellations maxi renvoyées ») |
| `requete` | string | Texte recherché (contenu de `q`) |
| `resultats[]` | array | Appellations |
| `resultats[].code` | string | Code OGR de l'appellation |
| `resultats[].libelle` | string | Libellé |
| `resultats[].emploiCadre` | boolean | |
| `resultats[].emploiReglemente` | boolean | |
| `resultats[].transitionEcologique` | boolean | |
| `resultats[].transitionNumerique` | boolean | |
| `resultats[].classification` | `PRINCIPALE` ou `SYNONYME` | |
| `resultats[].appellationEsco` | `{uri, libelle}` | Correspondance ESCO |
| `resultats[].metier` | `{code, libelle, riasecMajeur, riasecMineur}` | Fiche ROME de rattachement (`code` = code ROME) |

Erreurs : `400 Bad request`.

Exemple (doc officielle, valeurs de type) :

```bash
curl -s "https://api.francetravail.io/partenaire/rome-metiers/v1/metiers/appellation/requete?q=d%C3%A9veloppeur%20web" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```json
{
  "totalResultats": 259,
  "requete": "machin",
  "resultats": [
    {
      "code": "string",
      "libelle": "string",
      "emploiCadre": true,
      "emploiReglemente": true,
      "transitionEcologique": true,
      "transitionNumerique": true,
      "classification": "PRINCIPALE",
      "appellationEsco": { "uri": "string", "libelle": "string" },
      "metier": { "code": "string", "libelle": "string", "riasecMajeur": "R", "riasecMineur": "R" }
    }
  ]
}
```

### 4.6 `GET metier/{code}` et `GET appellation/{code}`

`Metier` : `code`, `libelle`, `definition`, `accesEmploi`, `riasecMajeur`, `riasecMineur`, `transitionEcologique`, `transitionNumerique`, `transitionDemographique`, `emploiCadre`, `emploiReglemente`, `codeIsco`, `domaineProfessionnel{code, libelle, grandDomaine{code, libelle}}`, `appellations[{code, libelle, libelleCourt, classification, ...}]`, `themes`, `competencesMobilisees`, `competencesMobiliseesPrincipales`, `competencesMobiliseesEmergentes`, `centresInterets`, `secteursActivites`, `divisionsNaf`, `formacodes`, `contextesTravail`, `metiersProches`, `metiersEnvisageables`, `appellationsProches`, `appellationsEnvisageables`.

`Appellation` : `code`, `libelle`, `libelleCourt`, `emploiCadre`, `emploiReglemente`, `transitionEcologique`, `transitionNumerique`, `classification`, `metier{...}`, `appellationEsco{uri, libelle}`, `competencesCles[{competence{code, libelle, codeOgr, type}, frequence}]`, `metiersProches`, `metiersEnvisageables`, `appellationsProches`, `appellationsEnvisageables`.

Exemple d'appel de la doc : `GET https://api.francetravail.io/partenaire/rome-metiers/v1/metiers/theme/{code}` avec `Authorization: Bearer [Access token]`.

### 4.7 Quotas et erreurs

- Documentation générale francetravail.io : « Deux niveaux de quotas » : un quota maximum par API (exemple : API Offres, 100 appels/s) et « Un quota maximum par application permet d'équilibrer le nombre de requêtes par application et par seconde » (exemple : « chaque application dispose d'un quota maximum de 4 appels par seconde » pour l'API Offres). « En cas de dépassement d'un quota, une erreur HTTP 429 (Too Many Requests) est retournée avec un en-tête Retry-After ». Augmentation possible via le formulaire de contact. « Ces quotas ne constituent en aucun cas un engagement de service ».
- Pour cette API, le champ CMS `nombreAppelMax` vaut **10**. ⚠️ Non vérifié : l'unité n'est pas rendue dans le JSON ; la documentation générale exprime le quota par application en appels par seconde, donc « 10 appels par seconde par application » est la lecture la plus probable, mais la page rendue (SPA) n'a pas pu être lue. La fiche data.gouv.fr du service « API ROME 4.0 » affiche de son côté « 1 appel / seconde » (valeur saisie à la main par le déposant, moins fiable) et une disponibilité de 99,8 %. Dans tous les cas : backoff exponentiel sur 429 et respect de `Retry-After`.
- Erreurs fréquentes documentées : `401 Unauthorized`, `429 Too Many Requests` (« Dépassement de quota »), `invalid_client`, `invalid_scope`.

### 4.8 Autres API ROME sur francetravail.io

| API | Endpoint / scope | Remarque |
|---|---|---|
| ROME 4.0 - Fiches métiers | `GET https://api.francetravail.io/partenaire/rome-fiches-metiers/v1/fiches-rome/fiche-metier/{code}` et `.../fiche-metier` (liste) ; scope `api_rome-fiches-metiersv1 nomenclatureRome` ; `nombreAppelMax: 10` ; licence ouverte | Fiche complète (équivalent de `unix_fiche_emploi_metier`) |
| ROME 4.0 - Compétences, ROME 4.0 - Contextes de travail | mentionnées dans la description | Hors besoin |
| ROME 4.0 - Substitutions d'entités | « Gérez les évolutions et remplacements de codes pour les appellations, compétences, contextes de travail et métiers » ; sous licence Etalab | Service dédié à la mécanique de substitution annoncée dans `version.txt` ; à évaluer si l'on veut migrer automatiquement des codes obsolètes dans `profiles.rome_codes` |
| SEMAFOR | moteur de recherche sémantique, accès `conditionnee`, collection « Appellations : constituée des appellations du ROME 4.0 » ; code source `https://github.com/betagouv/api-diagoriente-v6` | Accès conditionné : hors MVP |

Incohérence relevée sur la page « ROME 4.0 - Métiers » : un bloc indique encore « 551 fiches ROME, Plus de 11 000 appellations d'emploi » tandis qu'un autre bloc de la même page dit « 1 911 métiers (et plus de 14 300 appellations), 110 domaines professionnels, 14 grands domaines ». Se fier aux fichiers.

### 4.9 Verdict : fichier statique plutôt qu'API

Le fichier CSV donne exactement les mêmes codes, libellés et appellations que l'API, sans OAuth, sans quota, avec le même rythme de mise à jour (deux versions par an). L'API n'apporte que la recherche `appellation/requete` (20 résultats max, moteur interne) et des données riches (compétences, mobilités, ESCO) inutiles au MVP. Décision par défaut : **fichier statique en base, API France Travail non utilisée au MVP** (éventuellement plus tard pour une recherche floue côté serveur ou pour l'API Substitutions).

## 5. Codes ROME dans l'API Alternance (`api.apprentissage.beta.gouv.fr/api`)

### 5.1 Aucune route métiers / ROME / appellations

- La spécification locale (`api-alternance.openapi.json`, version `a18de31`) comporte 16 chemins : `/job/v1/search`, `/job/v1/offer`, `/job/v1/offer/{id}`, `/job/v1/offer/{id}/publishing-informations`, `/job/v1/apply`, `/job/v1/export`, `/certification/v1`, `/geographie/v1/commune/search`, `/geographie/v1/departement`, `/geographie/v1/mission-locale`, `/organisme/v1/recherche`, `/organisme/v1/export`, `/formation/v1/search`, `/formation/v1/{id}`, `/formation/v1/appointment/generate-link`, `/healthcheck`.
- Recherche des motifs `rome|metier|métier|appellation|certification|rncp|diploma|diplome` dans les noms de chemins et de composants : seuls `/certification/v1` et le schéma `Certification` correspondent (le mot « rome » apparaît 24 fois dans la spec, mais uniquement dans des noms de champs : `romes`, `rome_codes`, `domaines.rome`). **Il n'existe aucune route de recherche de métier par texte ni de récupération de libellés ROME.**
- Confirmé par l'arborescence du dépôt GitHub `mission-apprentissage/api-apprentissage` (routes : certification, geographie, healthcheck, job, organisme, formation).
- `https://api.apprentissage.beta.gouv.fr/metiers` et `https://api.apprentissage.beta.gouv.fr/fr/changelog` affichent « Page non trouvée » mais répondent **HTTP 200** (soft 404) : un contrôle par code HTTP ne détecte pas ces pages. Il n'existe pas de page changelog publique ; la seule source de vérité est la spécification OpenAPI en ligne (`https://api.apprentissage.beta.gouv.fr/api/documentation/json`, version `a18de31` le 09/09/2026).

### 5.2 Paramètre `romes` de `GET /job/v1/search`

| Paramètre | Emplacement | Type | Requis | Contraintes | Description (spec FR) |
|---|---|---|---|---|---|
| `romes` | query | string | non | aucun `pattern` ni maximum dans la spec ; côté La bonne alternance chaque code doit matcher `^[A-Z]\d{4}$` | « Liste des codes séparés par des virgules. Les codes doivent respecter les formats ROME ». Exemples : `"F1601,F1201,F1106"`, `"M1806"` |

Chaîne de validation réelle :

1. Serveur api-apprentissage (`server/src/server/routes/job/job.routes.ts`) : la route **transfère la querystring telle quelle** à La bonne alternance (`forwardApiRequest({ path: "/v3/jobs/search", querystring })`), avec `rateLimit: { max: 60, timeWindow: "1 minute" }`. Le SDK (`sdk/src/routes/jobs/job.routes.ts`, ligne 10) déclare `querystring: z.unknown()`.
2. La bonne alternance (`shared/src/routes/v3/jobs/jobs.routes.v3.model.ts`) : `romes: extensions.romeCodeArray().nullable().default(null)` et `rncp: extensions.rncpCode()`.
3. `romeCodeArray` (`shared/src/helpers/zod-helpers/zod-primitives.ts`) : `z.string().trim().transform(str => str.split(",")).refine(arr => arr.every(code => CODE_ROME_REGEX.test(code.trim())), { message: "One or more ROME codes are invalid. Expected format is 'D1234'." })`, avec `CODE_ROME_REGEX = new RegExp("^[A-Z]\\d{4}$")` (`shared/src/constants/regex.ts`).

Donc : chaîne, codes séparés par des virgules, chaque code au format `^[A-Z]\d{4}$`, **aucune limite de nombre dans le code lu**.

⚠️ Non vérifié : la fiche data.gouv.fr de l'API La bonne alternance mentionne « Maximum 20 ROME codes » ; cette limite n'apparaît ni dans la spec `a18de31` ni dans `romeCodeArray`. À tester avec la clé sandbox (par exemple 25 codes). Le brief prévoit 2 à 5 codes par profil, donc sans incidence au MVP.

Autres paramètres du même endpoint (pour mémoire, détail dans `docs/API_ALTERNANCE.md`) : `longitude` / `latitude`, `radius` (0 à 200, défaut 30), `target_diploma_level` (enum `"3"`, `"4"`, `"5"`, `"6"`, `"7"`), `rncp` (`^RNCP\d{3,5}$`), `opco` (enum), `departements[]`, `partners_to_exclude[]`.

Exemple de requête conforme (clé API en `Authorization: Bearer`, schéma de sécurité `api-key` de type http bearer ; clé sandbox accordée automatiquement à l'inscription, clé de production sur demande à `support_api@apprentissage.beta.gouv.fr`) :

```bash
curl -s "https://api.apprentissage.beta.gouv.fr/api/job/v1/search?romes=M1805,M1855&latitude=48.8566&longitude=2.3522&radius=30&target_diploma_level=6" \
  -H "Authorization: Bearer $API_ALTERNANCE_KEY"
```

Construction côté `lib/providers/api-alternance.ts` : `romes: profile.rome_codes.map(c => RomeCodeSchema.parse(c)).join(",")`. Ne jamais envoyer d'espace, de code en minuscules ni de `code_ogr`.

### 5.3 `rome_codes` dans les réponses

- `jobs[].offer.rome_codes` : tableau **requis** de chaînes `^[A-Z]\d{4}$` (exemple `["A1401"]`). À copier tel quel dans `offers.rome_codes`.
- Pour la publication d'offres (`JobOfferWrite`, hors périmètre du projet), `rome_codes` est nullable : « If the published offer does not have a ROME code provided, we deduce the ROME codes from the job offer title ». Conséquence : les offres partenaires sont parfois taguées par déduction depuis le titre, et la finesse des nouveaux codes 26M06 (ex. `M1877` blockchain) peut être inégalement utilisée.
- ⚠️ Non vérifié : dans quelle mesure les offres sont taguées avec les codes fins de la v61 plutôt qu'avec les anciens codes parents ; non mesurable sans clé. L'idée d'élargir une recherche au `code_rome_parent` (ou aux codes frères partageant le même parent) quand un code fin renvoie peu d'offres reste une hypothèse à tester en phase 2.
- Limites de la recherche : 150 offres au plus par source (450 max), sans pagination ; `GET /job/v1/export` : 2 appels par minute, données rafraîchies une fois par jour à 3 h (Paris).

### 5.4 `GET /certification/v1` : passer d'un diplôme RNCP aux codes ROME (hors MVP)

Filtres `identifiant.cfd` (regex `^[A-Z0-9]{3}\d{3}[A-Z0-9]{2}$`) et `identifiant.rncp` (regex `^RNCP\d{3,5}$`). Les certifications renvoyées portent `domaines.rome.rncp` : tableau `[{code (pattern ^[A-Z]{1}\d{0,4}$, ex. "D1102"), intitule (ex. "Boulangerie - viennoiserie")}]` (« ROME issue de France Compétences »), ou `null` quand `identifiant.rncp` est `null`. Usage possible plus tard : proposer des codes ROME à partir du diplôme préparé (`profiles.degree_label`) en complément du texte libre. Attention au motif lâche : filtrer avec `^[A-Z]\d{4}$` avant tout usage.

## 6. Anciennes routes La bonne alternance (`labonnealternance.apprentissage.beta.gouv.fr/api`)

### 6.1 Chronologie des suppressions

| Date | Événement |
|---|---|
| 2026-05-28 | Commit `5268e953` « chore: supprimer Swagger et ses dépendances de l'API v1 (#4717) » : `/api/docs/json`, `/api/api-docs/docs.json`, `/api-docs` renvoient 404 |
| 2026-08-26 | Commit `4df80d73` « feat: supprime les endpoints api v1 formations, formationsParRegion et metiers (#5193) (#5261) » : suppression de `server/src/http/controllers/metiers.controller.ts` et `shared/src/routes/metiers.routes.ts`, ajout de `shared/src/routes/_private/metiers.routes.ts` |
| 2026-09-09 | Vérifié en direct : `/api/v1/metiers/metiers?title=`, `/api/v1/metiers/intitule?label=`, `/api/v1/metiers/all`, `/api/v1/metiers/metiersParRomes`, `/api/v1/metiers` renvoient toutes `404 {"statusCode":404,"error":"Not Found"}` ; `/api/healthcheck` répond « La bonne alternance », version `1.899.1`, `env: production` |

### 6.2 Routes internes encore vivantes (non documentées, sans clé)

⚠️ Non vérifié : ces routes répondent le 09/09/2026 (`securityScheme: null`, aucune authentification) mais ne sont ni documentées ni contractuelles ; aucune source officielle n'en garantit la pérennité, et l'équipe a supprimé les routes v1 sans dépréciation publique. **Ne pas construire dessus** (décision C41 de `docs/QUESTIONS.md`). Elles restent utiles ponctuellement pour vérifier une fiche à la main.

`GET /api/rome?title=<texte>&withRomeLabels=<bool>` :

| Paramètre | Type | Requis | Remarque |
|---|---|---|---|
| `title` | string | oui | Sans lui : `400` Zod « querystring.title: Invalid input: expected string, received undefined » |
| `withRomeLabels` | boolean | non | Ajoute `romeTitles` |

Réponse (schéma `ZMetiersEnrichis`) : `{ labelsAndRomes: [{ label, romes: string[], rncps: string[], type: "job", romeTitles?: [{ codeRome, intitule }] }], labelsAndRomesForDiplomas: [{ label, romes, rncps, type: "diploma" }] }`. En-tête `Cache-Control: public, max-age=604800` (7 jours). Ce sont les **« domaines métiers » propres à La bonne alternance** (regroupements pondérés par mots-clés), pas une recherche d'appellations ROME : `title=informatique` renvoie 20 + 20 entrées, la première étant `label: "Maintenance, installation et assistance informatique"` avec 21 codes (`H1101`, `H1106`, ..., `M1874`).

```json
{
  "labelsAndRomes": [
    {
      "label": "Maintenance, installation et assistance informatique",
      "romes": ["H1101", "H1106", "H1107", "I1401", "M1866", "M1874"],
      "rncps": ["RNCP13374", "RNCP15238"],
      "type": "job",
      "romeTitles": [
        { "codeRome": "H1101", "intitule": "Ingénieur / Ingénieure support technique" },
        { "codeRome": "I1401", "intitule": "Technicien / Technicienne de maintenance en informatique" }
      ]
    }
  ],
  "labelsAndRomesForDiplomas": [
    {
      "label": "SERVICES INFORMATIQUES AUX ORGANISATIONS OPTION B SOLUTIONS LOGICIELLES ET APPLICATIONS METIERS",
      "romes": ["M1810", "M1801", "M1805", "M1855"],
      "rncps": ["RNCP40792"],
      "type": "diploma"
    }
  ]
}
```

`GET /api/rome/detail/{code}` : fiche complète `{ numero, rome: { code_rome, intitule, code_ogr }, appellations: [{ libelle, libelle_court, code_ogr }], definition, acces_metier, competences: {...}, contextes_travail, mobilites }` (schéma `ZReferentielRomeForJob`) ; `404 "rome X not found"` sinon.

```json
{
  "numero": "567",
  "rome": { "code_rome": "M1805", "intitule": "Développeur / Développeuse informatique", "code_ogr": "494" },
  "appellations": [
    { "libelle": "Développeur / Développeuse informatique", "libelle_court": "Développeur / Développeuse informatique", "code_ogr": "14153" }
  ]
}
```

`GET /api/_private/metiers/intitule?label=<texte>` : `{ coupleAppellationRomeMetier: [{ code_rome, intitule, appellation }] }`. Le préfixe `_private` indique un usage interne au site. Exemple `label=développeur web` (7 couples) :

```json
{
  "coupleAppellationRomeMetier": [
    { "code_rome": "M1855", "intitule": "Développeur / Développeuse web", "appellation": "Développeur / Développeuse back-end" },
    { "code_rome": "M1855", "intitule": "Développeur / Développeuse web", "appellation": "Développeur / Développeuse front-end" },
    { "code_rome": "M1855", "intitule": "Développeur / Développeuse web", "appellation": "Développeur / Développeuse full-stack" }
  ]
}
```

Échantillons complets : `docs/reference/rome/lba-legacy-rome-routes.samples.json`.

## 7. Quotas, cache et rétention

| Source | Quota | Cache et rétention |
|---|---|---|
| Export open data France Travail | Aucun quota documenté ; téléchargement automatisé autorisé par les engagements de service | Données à conserver en base sans limite (Licence Ouverte, durée illimitée). Rafraîchir au plus deux fois par an ; conserver l'archive importée. Pas de `ETag` ni `Last-Modified` : ne pas tenter de requête conditionnelle |
| API data.gouv.fr (métadonnées) | Non documenté ici | Un appel par vérification (mensuel) suffit |
| API France Travail ROME 4.0 - Métiers | `nombreAppelMax: 10` (unité ⚠️ Non vérifié, probablement par seconde et par application) ; 429 + `Retry-After` en cas de dépassement ; jeton valide `expires_in` secondes (1 499 s dans l'exemple) | Non utilisée au MVP. Si utilisée : mettre le jeton en cache jusqu'à `expires_in - 60 s`, identifiants désactivés après 12 mois sans usage |
| API Alternance `GET /job/v1/search` | 60 appels par minute par clé | Le brief impose un cache de 6 h par couple ROME + zone (`docs/API_ALTERNANCE.md`) |
| Routes internes La bonne alternance | Aucun quota documenté ; `Cache-Control: public, max-age=604800` sur `/api/rome` | Non utilisées |

## 8. Licence, conditions d'utilisation et attribution

### 8.1 Licence Ouverte ROME (`rome_licence_ouverte.pdf`, encore au nom de Pôle emploi)

- Droits accordés au réutilisateur, dans le monde entier et pour une durée illimitée : reproduire, copier, publier et transmettre ; diffuser et redistribuer ; adapter, modifier, extraire et transformer (« Informations dérivées ») ; « exploiter "l'Information" à titre commercial, par exemple, en la combinant avec d'autres informations, ou en l'incluant dans son propre produit ou application ».
- **Seule obligation** : « mentionner la paternité de "l'Information", c'est-à-dire sa source, laquelle comprend a minima le nom de Pôle emploi et la date de la dernière actualisation ». La réutilisation ne doit pas induire en erreur les tiers quant au contenu, à la source et à la date de dernière actualisation.
- Pas de garantie : Pôle emploi « ne peut garantir l'absence d'inexactitudes » et « ne garantit pas non plus la fourniture continue de l'Information ».
- Exclusions : les tables ROME/Formacode et FAP/PCS/ROME relèvent des conditions du Centre Inffo et de la DARES (non utilisées par le projet).
- La page francetravail.org précise que télécharger les fichiers implique d'avoir accepté cette licence, et que « Les données du ROME en open data sont également disponibles sur francetravail.io ». data.gouv.fr déclare la licence `fr-lo` (Licence Ouverte Etalab).

### 8.2 CGU francetravail.io (version du 1er janvier 2025)

Applicables uniquement si l'API France Travail est branchée : identifiants strictement personnels ; désactivation après 12 mois consécutifs sans utilisation (préavis de 15 jours) ; suspension possible en cas de non-respect ; les API de données publiques dont ROME 4.0 sont sous licence Etalab.

### 8.3 CGU de l'API Alternance (v1.0, 31 mars 2025), article 5.2

L'utilisateur « s'engage à ne pas commercialiser les données reçues et à ne pas les communiquer à des tiers en dehors des cas prévus par la loi ». Le jeton d'accès doit rester secret (« toute divulgation du jeton quelle que soit sa forme, est interdite »). L'éditeur « se réserve la liberté de faire évoluer, de modifier ou de suspendre, sans préavis, la Plateforme » et peut « suspendre ou de bloquer l'accès à un compte ». Cette clause ne concerne pas la nomenclature ROME elle-même (Licence Ouverte) mais les données d'offres ; elle rejoint la question bloquante A1 de `docs/QUESTIONS.md` (compatibilité du modèle payant par crédits) et y est citée textuellement.

### 8.4 Mention à afficher dans l'application

Dans les mentions légales et à proximité du sélecteur de métiers (étape 3 de l'onboarding) :

> Source : France Travail (ex Pôle emploi), Répertoire Opérationnel des Métiers et des Emplois, ROME 4.0 version 61 du 15/06/2026, Licence Ouverte.

La version et la date doivent être lues depuis la table `rome_versions` pour suivre les imports, jamais codées en dur.

## 9. État actuel et dépréciations

| Élément | État au 09/09/2026 | Dates |
|---|---|---|
| ROME 4.0 version 61 « 26M06 » | Version courante | Validée le 27/04/2026, publiée le 15/06/2026 ; prochaine version annoncée pour octobre 2026 |
| ROME V3 | Remplacé | Devenu ROME 4.0 en mars 2023 ; même format de code, arborescence conservée ; nouvelle arborescence « en cours d'instruction » |
| Documentation technique open data | v3.0 | 15/06/2026, aucune évolution de structure des CSV/XML/JSON |
| Export CSV/JSON/XML `api.francetravail.fr` | Actif | Fichiers datés du 13/06/2026 |
| API France Travail ROME 4.0 - Métiers (`rome-metiers` v1) | Active, documentation version 12.0 | Modifiée le 2025-09-30 |
| API Alternance, routes métiers | N'ont jamais existé dans `api.apprentissage.beta.gouv.fr` | Spec `a18de31` le 09/09/2026 |
| La bonne alternance `/api/v1/metiers/*` | **Supprimée** | Swagger v1 retiré le 28/05/2026, routes retirées le 26/08/2026 |
| La bonne alternance `/api/rome`, `/api/rome/detail/{code}`, `/api/_private/metiers/intitule` | Vivantes mais internes, sans contrat | Vérifiées le 09/09/2026 (version serveur `1.899.1`) |
| Engagements de service open data ROME | Document d'octobre 2019, jamais mis à jour | Encore au nom de Pôle emploi |

## 10. Pièges

1. **`code_ogr` n'est pas un code ROME.** Seul le code à 5 caractères est accepté par `romes`. Les résultats de `appellation/requete` de l'API France Travail donnent le code ROME dans `resultats[].metier.code`, pas dans `resultats[].code`.
2. **Un code peut changer de sens entre deux versions** (exemples `M1819`, `M1854` en v61). Stocker `rome_version` et réafficher les libellés depuis la table ; prévoir `is_active` pour les codes disparus.
3. **Export JSON piégeux** : ISO-8859-15 et `code_rome` absent des appellations. Utiliser le CSV.
4. **CSV avec virgules dans les libellés** : parseur CSV obligatoire, champs entre guillemets.
5. **En-tête fautif** `code_domaine_professionel` / `libelle_domaine_professionel` dans `unix_cr_gd_dp` : reprendre l'orthographe telle quelle, ou dériver le domaine des 3 premiers caractères du code.
6. **Pas de HEAD, pas de `Last-Modified`** sur les endpoints de téléchargement : détection de version via data.gouv `last_modified` ou `version.txt`.
7. **Soft 404** sur `api.apprentissage.beta.gouv.fr/metiers` et `/fr/changelog` (HTTP 200 avec « Page non trouvée »).
8. **Motif lâche** `^[A-Z]{1}\d{0,4}$` dans `Certification.domaines.rome.rncp[].code` : filtrer avec le motif strict.
9. **Chiffres obsolètes** sur la page francetravail.io (551 fiches, 11 000 appellations) : les compteurs fiables sont ceux de `version.txt` et des fichiers.
10. **Appellations `peu_usite = O`** (467) : à exclure ou dépondérer dans l'index de recherche.
11. **401 générique** sur `api.francetravail.io` : un 401 sur un chemin ne prouve pas que la route existe.
12. **Déduction des `rome_codes` depuis le titre** côté La bonne alternance : les offres peuvent porter un code parent plutôt qu'un code fin.

## 11. Intégration recommandée dans Candidatly

### 11.1 Schéma Postgres (tables de référence, clé naturelle)

Conventions du projet : `snake_case`, RLS activée, lecture seule pour `authenticated`, écriture uniquement par le script d'import avec la clé secret.

```sql
create table rome_versions (
  version int primary key,
  published_at date,
  validated_at date,
  comment text,
  imported_at timestamptz not null default now()
);

create table rome_grand_domaines (
  code char(1) primary key,
  label text not null
);

create table rome_domaines_professionnels (
  code char(3) primary key,
  grand_domaine char(1) not null references rome_grand_domaines(code),
  label text not null
);

create table rome_codes (
  code text primary key check (code ~ '^[A-Z]\d{4}$'),
  label text not null,
  domaine_professionnel char(3) not null references rome_domaines_professionnels(code),
  code_rome_parent text,
  transition_eco text,
  transition_num boolean,
  transition_demo boolean,
  emploi_reglemente boolean,
  emploi_cadre boolean,
  rome_version int not null references rome_versions(version),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rome_appellations (
  code_ogr int primary key,
  code_rome text not null references rome_codes(code),
  label_long text not null,
  label_short text not null,
  classification text not null check (classification in ('PRINCIPALE', 'SYNONYME')),
  peu_usite boolean not null default false,
  rome_version int not null references rome_versions(version),
  is_active boolean not null default true
);

alter table rome_codes enable row level security;
alter table rome_appellations enable row level security;
create policy "rome_codes_read" on rome_codes for select to authenticated using (true);
create policy "rome_appellations_read" on rome_appellations for select to authenticated using (true);
```

Volumes : 1 911 codes (charge utile code + libellé 90 777 octets bruts, 138 555 octets sérialisés en JSON) et 14 301 appellations (1 409 134 octets bruts, 2 152 791 octets en JSON) : quelques Mo avec index, négligeable pour Supabase.

Conversion des colonnes `O` / `N` / `""` : `O` vers `true`, `N` vers `false`, `""` vers `null`.

### 11.2 Import et rafraîchissement (`scripts/import-rome.ts`)

1. Télécharger `RefRomeCsv.zip` (GET uniquement) ou passer par l'URL stable data.gouv (302).
2. Lire `version.txt` ; arrêter si `Numero de version` est inférieur ou égal à `max(rome_versions.version)`.
3. Parser les CSV UTF-8 avec un parseur gérant les guillemets ; échouer si une colonne attendue manque.
4. En une transaction : insérer la ligne `rome_versions` ; upsert `rome_grand_domaines`, `rome_domaines_professionnels`, `rome_codes`, `rome_appellations` ; passer `is_active = false` aux codes et appellations absents de la nouvelle version (ne jamais supprimer : `profiles.rome_codes` peut encore les référencer).
5. Journaliser le nombre de créations, mises à jour, désactivations ; comparer avec le ChangeLog xlsx en cas de doute.
6. Mettre à jour la mention légale (lue depuis `rome_versions`).

Fréquence : manuelle à chaque nouvelle version (deux par an), ou tâche Supabase Cron mensuelle de vérification de `last_modified` qui alerte sans importer.

### 11.3 Recherche texte et garde-fou contre les hallucinations du LLM

Flux de l'étape 3 de l'onboarding (`lib/ai/rome-mapping.ts`) :

1. Normaliser le texte libre de l'étudiant (`profiles.domain_free_text`).
2. Requête plein texte Postgres sur `rome_appellations.label_long` et `rome_codes.label` (configuration `french`, idéalement avec `unaccent` ; alternative trigrammes `pg_trgm` pour la tolérance aux fautes), en dépondérant `peu_usite = true` et `classification = 'SYNONYME'`, pour obtenir **20 à 40 codes candidats** avec libellés officiels.
3. Appeler `claude-haiku-4-5-20251001` (`client.messages.parse` + `zodOutputFormat`) avec le texte et **uniquement ces candidats**, sortie stricte `{ codes: [{ code, reason }] }` (3 à 5 éléments).
4. Valider avec Zod que chaque `code` matche `^[A-Z]\d{4}$` **et** appartient à la liste des candidats, puis rejoindre `rome_codes` pour afficher les libellés officiels (jamais ceux générés). Une seule régénération en cas d'échec (convention `CLAUDE.md`), puis repli sur les meilleurs résultats de la recherche texte.
5. L'étudiant coche ou ajuste ; enregistrer 2 à 5 codes dans `profiles.rome_codes` après vérification serveur que chaque code existe et est actif dans `rome_codes`.

Ce schéma rend l'invention de code impossible par construction.

Guide Supabase « Full Text Search » : colonne générée `tsvector` + index GIN, `websearch_to_tsquery()` pour les saisies utilisateur, `ts_rank()` pour le classement :

```sql
alter table rome_appellations
  add column fts tsvector generated always as (to_tsvector('french', label_long)) stored;
create index rome_appellations_fts_idx on rome_appellations using gin (fts);
```

### 11.4 Extensions Postgres sur Supabase

Une extension s'active par `create extension <nom> with schema extensions;` ou via le tableau de bord (Database > Extensions). ⚠️ Non vérifié : la disponibilité de `pg_trgm` et `unaccent` sur Supabase n'a pas pu être confirmée dans la documentation lue (pages dédiées en 404, page générale sans liste exhaustive). Ce sont des modules contrib Postgres standard ; à vérifier en phase 1 par `create extension` dans une migration locale (`supabase start`). Sans `unaccent`, la configuration `french` de `to_tsvector` fonctionne mais ne neutralise pas les accents manquants dans la saisie.

## 12. Mapping vers notre schéma

Tables du brief (section 4) et tables de référence proposées (section 11.1).

| Table / colonne cible | Type | Source | Règle |
|---|---|---|---|
| `profiles.domain_free_text` | text | Saisie de l'étudiant | Entrée de la recherche texte et du prompt Haiku ; jamais envoyée à l'API Alternance |
| `profiles.rome_codes` | text[] (2 à 5) | Codes choisis parmi les candidats, validés contre `rome_codes.code` | Format `^[A-Z]\d{4}$`, existence et `is_active = true` vérifiées côté serveur ; libellés non stockés dans le profil |
| `profiles` (colonne à ajouter, écart à tracer dans `docs/QUESTIONS.md`) : `rome_version int` | int | `rome_versions.version` au moment du choix | Permet de détecter un profil à réviser après une nouvelle version |
| `offers.rome_codes` | text[] | `jobs[].offer.rome_codes` de `GET /job/v1/search` et `GET /job/v1/offer/{id}` | Copie telle quelle ; peut contenir des codes inconnus de la table locale si l'API est en avance ou en retard sur la version importée : ne pas rejeter l'offre, ignorer le code pour le score |
| `offers.raw` | jsonb | Payload brut | Conserve `rome_codes` d'origine |
| `matches.score_reasons` | jsonb | Intersection entre `profiles.rome_codes` et `offers.rome_codes` | Composante « correspondance ROME » du score ; option phase 2 : correspondance partielle si même `code_rome_parent` ou même domaine professionnel (3 premiers caractères) |
| `companies.naf_code` | text | API Recherche d'entreprises | Aucun lien direct avec le ROME au MVP ; la table ROME/NAF (xlsx) et le filtre `code-naf` de l'API France Travail sont des pistes V2 |
| `rome_codes.code` | text pk | `referentiel_code_rome.code_rome` | |
| `rome_codes.label` | text | `referentiel_code_rome.libelle_rome` | Libellé officiel affiché partout |
| `rome_codes.domaine_professionnel` | char(3) | 3 premiers caractères de `code_rome` (ou `unix_cr_gd_dp.code_domaine_professionel`) | |
| `rome_codes.code_rome_parent` | text | `referentiel_code_rome.code_rome_parent` | |
| `rome_codes.transition_eco` | text | `referentiel_code_rome.transition_eco` | Chaîne vide vers `null` |
| `rome_codes.transition_num`, `transition_demo`, `emploi_reglemente`, `emploi_cadre` | boolean | Colonnes homonymes | `O` vers `true`, `N` vers `false`, `""` vers `null` |
| `rome_codes.rome_version` | int | `version.txt` Numero de version | |
| `rome_appellations.code_ogr` | int pk | `referentiel_appellation.code_ogr` | |
| `rome_appellations.code_rome` | text fk | `referentiel_appellation.code_rome` | Présent dans le CSV seulement (absent du JSON) |
| `rome_appellations.label_long`, `label_short` | text | `libelle_appellation_long`, `libelle_appellation_court` | Index plein texte sur `label_long` |
| `rome_appellations.classification` | text | `classification` | `PRINCIPALE` ou `SYNONYME` |
| `rome_appellations.peu_usite` | boolean | `peu_usite` | `O` vers `true` |
| `rome_grand_domaines.code`, `label` | char(1), text | `grand_domaine.code_grand_domaine`, `libelle_grand_domaine` | |
| `rome_domaines_professionnels.code`, `label`, `grand_domaine` | char(3), text, char(1) | `domaine_professionnel.*`, 1er caractère du code | |
| `rome_versions.version`, `published_at`, `validated_at`, `comment` | int, date, date, text | `version.txt` (Numero de version, Date de publication, Date de validation, Titre/commentaire) | Dates au format `JJ/MM/AAAA` à convertir |

Champs de l'API France Travail (si branchée un jour) vers les mêmes colonnes : `metier.code` vers `rome_codes.code`, `metier.libelle` vers `rome_codes.label`, `appellation.code` vers `rome_appellations.code_ogr`, `appellation.libelle` / `libelleCourt` vers `label_long` / `label_short`, `appellation.classification` vers `classification`, `appellation.metier.code` vers `rome_appellations.code_rome`.

## 13. Points restant à vérifier

1. ⚠️ Non vérifié : unité du champ `nombreAppelMax = 10` de l'API France Travail ROME 4.0 - Métiers (très probablement appels par seconde et par application ; la fiche data.gouv indique « 1 appel / seconde »). À confirmer sur la page rendue après création d'un compte francetravail.io, seulement si l'API est branchée.
2. ⚠️ Non vérifié : existence d'un maximum de 20 codes ROME par appel à `GET /job/v1/search` (fiche data.gouv de La bonne alternance), absent de la spec et du code `romeCodeArray`. À tester en sandbox avec 25 codes (point F6 de `docs/QUESTIONS.md`).
3. ⚠️ Non vérifié : disponibilité de `pg_trgm` et `unaccent` sur Supabase. À vérifier en phase 1 par `create extension` dans une migration locale.
4. ⚠️ Non vérifié : pérennité des routes internes `/api/rome`, `/api/rome/detail/{code}` et `/api/_private/metiers/intitule` de La bonne alternance. Aucune garantie ; ne pas en dépendre.
5. ⚠️ Non vérifié : regex de validation côté France Travail (paramètres `code` et `q`), swagger `1687` inaccessible sans compte.
6. ⚠️ Non vérifié : part des offres de l'API Alternance taguées avec les codes fins de la v61 plutôt qu'avec les codes parents ; intérêt d'élargir la recherche au `code_rome_parent`. À mesurer en phase 2 avec le jeton production (un jeton sandbox renvoie les offres de test).
7. Un éventuel ajout de la colonne `profiles.rome_version` (section 12) est un écart par rapport au schéma du brief, à soumettre dans `docs/QUESTIONS.md`.

## 14. Sources

Fichiers locaux (copies du 9 septembre 2026) :

- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/rome/rome-referentiel-code-rome-v461-utf8.csv`
- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/rome/rome-referentiel-appellation-v461-utf8.csv`
- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/rome/rome-grand-domaine-v461-utf8.csv`
- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/rome/rome-domaine-professionnel-v461-utf8.csv`
- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/rome/rome-cr-gd-dp-v461-utf8.csv`
- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/rome/rome-version-61-version.txt`
- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/rome/rome-open-data-description-v3.0.extracted.txt`
- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/rome/rome-licence-ouverte.extracted.txt`
- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/rome/datagouv-rome-dataset.api.json`
- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/rome/francetravail-io-rome-4-0-metiers.page.json`
- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/rome/francetravail-io-rome-4-0-fiches-metiers.page.json`
- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/rome/lba-legacy-rome-routes.samples.json`
- `/Users/noanbarbelin/Desktop/candidatly/docs/reference/api-alternance.openapi.json` et `api-alternance.openapi.fr.json`

Open data France Travail et data.gouv.fr :

- https://www.data.gouv.fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome
- https://www.data.gouv.fr/api/1/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome/
- https://www.data.gouv.fr/api/1/datasets/r/8cf674b6-ef21-446a-8190-178e2defd6fc
- https://www.data.gouv.fr/api/1/datasets/r/1c893376-8476-4262-9a0e-8df519883e1e
- https://www.data.gouv.fr/api/1/datasets/r/88342be1-06b8-4ab6-8ce9-83e117d21346
- https://www.data.gouv.fr/dataservices/api-repertoire-operationnel-des-metiers-et-des-emplois-rome-4-0
- https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/csv
- https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/json
- https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/xml
- https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/pdf
- https://www.francetravail.org/opendata/repertoire-operationnel-des-meti.html?type=article
- https://www.francetravail.org/files/live/sites/peorg/files/documents/Statistiques-et-analyses/Open-data/ROME/rome-arborescence-principale-juin-2026.xlsx
- https://www.francetravail.org/files/live/sites/peorg/files/documents/Statistiques-et-analyses/Open-data/ROME/260609-changelogv60-v61.xlsx
- https://www.francetravail.org/files/live/sites/peorg/files/documents/Statistiques-et-analyses/Open-data/ROME/open-data-v3.0.pdf
- https://www.francetravail.org/files/live/sites/peorg/files/documents/Statistiques-et-analyses/Open-data/ROME/rome_licence_ouverte.pdf
- https://www.francetravail.org/files/live/sites/peorg/files/documents/Statistiques-et-analyses/Open-data/ROME/engagements_pe_rome.pdf
- https://www.francetravail.org/files/live/sites/peorg/files/documents/Statistiques-et-analyses/Open-data/ROME/ROME_Presentation.pdf
- https://dares.travail-emploi.gouv.fr/donnees/la-nomenclature-des-familles-professionnelles-2021

francetravail.io (API ROME 4.0) :

- https://francetravail.io/api-peio/v2/pages/page?slug=produits-partages/catalogue/rome-4-0-metiers
- https://francetravail.io/api-peio/v2/pages/page?slug=data/api/rome-4-0-metiers (ancien slug, 301)
- https://francetravail.io/api-peio/v2/pages/page?slug=produits-partages/catalogue/rome-4-0-fiches-metiers
- https://francetravail.io/api-peio/v2/pages/page?slug=produits-partages/catalogue/semafor
- https://francetravail.io/api-peio/v2/pages/page?slug=produits-partages/documentation
- https://francetravail.io/api-peio/v2/pages/page?slug=produits-partages/documentation/gestion-compte-applications
- https://francetravail.io/api-peio/v2/pages/page?slug=produits-partages/documentation/utilisation-api-france-travail/client-credentials
- https://francetravail.io/api-peio/v2/pages/page?slug=produits-partages/documentation/conditions-dutilisation-api/licence-etalab
- https://francetravail.io/api-peio/v2/pages/page?slug=cgu
- https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire
- https://api.francetravail.io/partenaire/rome-metiers/v1/metiers/metier
- https://github.com/betagouv/api-diagoriente-v6

API Alternance et La bonne alternance :

- https://api.apprentissage.beta.gouv.fr/fr/documentation-technique
- https://api.apprentissage.beta.gouv.fr/api/documentation/json
- https://api.apprentissage.beta.gouv.fr/fr/cgu
- https://api.apprentissage.beta.gouv.fr/metiers (soft 404)
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/sdk/src/docs/routes/jobSearch/fr/parameters/romes.md
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/server/src/server/routes/job/job.routes.ts
- https://raw.githubusercontent.com/mission-apprentissage/api-apprentissage/main/sdk/src/routes/jobs/job.routes.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/routes/v3/jobs/jobs.routes.v3.model.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/helpers/zod-helpers/zod-primitives.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/constants/regex.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/routes/rome.routes.ts
- https://raw.githubusercontent.com/mission-apprentissage/labonnealternance/main/shared/src/models/diplomes-metiers.model.ts
- https://api.github.com/repos/mission-apprentissage/labonnealternance/commits/4df80d730223920ce7370a4c7e26f49658d3ba4d
- https://api.github.com/repos/mission-apprentissage/labonnealternance/commits?path=shared/src/routes/metiers.routes.ts&per_page=5
- https://labonnealternance.apprentissage.beta.gouv.fr/api/healthcheck
- https://labonnealternance.apprentissage.beta.gouv.fr/api/v1/metiers/metiers?title=informatique (404)
- https://labonnealternance.apprentissage.beta.gouv.fr/api/rome
- https://labonnealternance.apprentissage.beta.gouv.fr/api/rome/detail/M1805
- https://labonnealternance.apprentissage.beta.gouv.fr/api/_private/metiers/intitule?label=d%C3%A9veloppeur%20web

Supabase :

- https://supabase.com/docs/guides/database/extensions
- https://supabase.com/docs/guides/database/full-text-search
