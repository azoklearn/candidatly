# Questions ouvertes et décisions (phase 0)

Dernière mise à jour : 10 septembre 2026.

Comment lire ce document :
- **A. Bloquant** : une réponse de l'owner est nécessaire avant de construire dessus. Pour chaque question : pourquoi elle bloque, les options, la recommandation.
- **B. Accord requis** : écarts par rapport au brief ou librairies hors stack. Le brief impose une justification et un accord explicite ; l'hypothèse par défaut est indiquée et sera appliquée sans réponse contraire lors de la validation de la phase 0.
- **C. Non bloquant** : hypothèse par défaut appliquée, à corriger si besoin.
- **D. Comptes et accès** à préparer côté owner, **E. Versions**, **F. Vérifications** à faire dès que les jetons de l'API Alternance existent.

Les faits cités proviennent de `docs/API_ALTERNANCE.md`, `docs/API_RECHERCHE_ENTREPRISES.md`, `docs/API_ADRESSE.md`, `docs/ROME.md` et des spécifications sauvegardées dans `docs/reference/`.

---

## A. Questions bloquantes

### A1. Le modèle payant est-il compatible avec les conditions de l'API Alternance, et obtiendrons-nous l'habilitation de production ?

**Pourquoi c'est bloquant.** Le cœur du produit (offres via `GET /job/v1/search`, envoi via `POST /job/v1/apply`) dépend de conditions que nous ne contrôlons pas et qui, telles qu'elles sont publiées, interdisent le modèle du brief :
1. Les pages officielles des routes de recherche et de détail d'offre (vérifiées dans le HTML servi par le portail le 9 septembre 2026) indiquent : « L'utilisation de cette API est gratuite et réservée à des usages non lucratifs. Notez que toute utilisation de ces données à des fins commerciales, telles que la revente ou la facturation de l'accès pour des tiers comme des candidats est interdite. » La page du détail d'offre ajoute « candidats, entreprises ou écoles ». Facturer à l'étudiant un crédit par candidature envoyée, ou réserver l'affichage des offres aux utilisateurs payants, tombe sous cette clause.
2. Les CGU du portail (v1.0, 31 mars 2025) : « Il s'engage à ne pas commercialiser les données reçues et à ne pas les communiquer à des tiers en dehors des cas prévus par la loi. »
3. L'habilitation `applications:write` en production est accordée à la main par le support (`support_api@apprentissage.beta.gouv.fr`). La page de la route de candidature dit : « Cette API est réservée aux services traitant un volume important de candidatures. Les demandes d'habilitation pour un usage individuel ne seront pas accordées. »
4. Seule nuance : la licence des données déclarée dans la spécification est Etalab 2.0 (réutilisation commerciale autorisée avec mention de la source). Elle couvre les données d'offres, pas le service de candidature, et ne l'emporte pas sur les conditions affichées par le portail.

Sans accord écrit du support, construire les phases 2 à 4 sur ce canal expose à la révocation de la clé (CGU art. 5.1) et à un produit inutilisable.

**Options.**
1. Demander maintenant au support un accord écrit et une clé de production avec `applications:write`, en décrivant le service honnêtement (brouillon ci-dessous). La phase 1 peut démarrer en attendant (elle n'utilise que des réponses simulées) ; en cas de refus, basculer sur l'option 2 ou 3.
2. Rendre la consultation des offres et l'envoi gratuits, et ne facturer que nos services propres (adaptation de la lettre, fiche entreprise, suivi) : le crédit est débité à la validation de la lettre, pas à l'envoi. Cela respecte la lettre de la clause (aucune facturation de l'accès aux données ni à la candidature) mais reste à confirmer avec le support, le service dans son ensemble étant lucratif.
3. Ne pas dépendre de l'API Alternance pour l'envoi : lettre adaptée + redirection vers `apply.url` + suivi manuel, et étudier en V2 des sources d'offres dont les conditions autorisent explicitement un usage commercial (à vérifier : API France Travail « Offres d'emploi », Adzuna).
4. Widget officiel `/postuler` de La bonne alternance (iframe) pour les offres avec email de contact : l'étudiant candidate via le formulaire LBA depuis notre site, sans habilitation. La clause d'usage non lucratif s'applique cependant tout autant à l'affichage des offres.

**Recommandation.** Option 1 immédiatement (un email suffit), avec l'option 2 proposée explicitement dans l'email comme position de repli : c'est celle qui a le plus de chances d'être acceptée et qui change le moins le produit. Concevoir la phase 1 pour que le moment du débit de crédit (envoi ou validation de la lettre) et le canal d'envoi (`api_alternance`, `manual`, `widget`) soient des paramètres, pas des choix figés dans le schéma.

**Ce que A1 bloque.** La phase 1 (fondations, schéma, authentification, client API testé sur des réponses simulées) n'en dépend pas et peut démarrer dès la validation de la phase 0. La phase 2 affiche à des utilisateurs d'un service payant des offres issues de l'API : elle ne devrait pas démarrer sans réponse du support, sauf décision explicite de l'owner d'avancer sans cette réponse.

**Brouillon d'email au support (à envoyer par l'owner).**

> Objet : Demande d'habilitation pour l'envoi de candidature aux opportunités d'emploi en alternance
>
> Bonjour,
>
> Je développe Candidatly, un service en ligne destiné aux étudiants (Bac+2 à Bac+5) à la recherche d'une alternance. Le service recherche les opportunités via `GET /job/v1/search` (codes ROME, géolocalisation, niveau), présente à l'étudiant une fiche de l'employeur (données publiques de l'API Recherche d'entreprises et site de l'entreprise) et l'aide à adapter sa propre lettre de motivation à l'offre. Chaque candidature est relue et validée explicitement par l'étudiant avant envoi ; aucune candidature n'est envoyée automatiquement. Nous souhaitons transmettre ces candidatures via `POST /job/v1/apply`, avec les coordonnées réelles de l'étudiant et son CV.
>
> Vos pages indiquent que l'API est réservée à des usages non lucratifs et que la facturation de l'accès aux candidats est interdite. Notre service est payant pour l'étudiant sous forme de crédits (quelques euros pour un lot de candidatures, sans abonnement). Nous voulons donc vérifier avec vous ce qui est acceptable : (a) un modèle où le crédit correspond à une candidature envoyée via l'API ; ou, si ce modèle n'est pas compatible, (b) un modèle où la consultation des offres et l'envoi des candidatures restent gratuits et où seule l'aide à la rédaction (adaptation de la lettre, fiche entreprise) est payante. Dans les deux cas, les données de l'API ne sont ni revendues ni communiquées à des tiers, et la source « La bonne alternance » est mentionnée avec un lien vers l'offre.
>
> Si l'un de ces modèles vous convient, nous demandons une clé de production avec l'habilitation `applications:write`. Volumes estimés au lancement : [X] candidatures par jour, [Y] étudiants actifs, montée en charge entre juin et novembre. Nous respecterons les limites de débit (10 candidatures par minute) et sommes preneurs de toute règle complémentaire (nombre de candidatures par entreprise et par jour, conservation des données).
>
> Cordialement,
> [Nom, société ou statut, site web]

### A2. Que fait-on des offres qui ne sont pas candidatables par l'API ?

**Pourquoi c'est bloquant.** La spécification est explicite : « Si `apply.recipient_id` est null, la candidature n'est pas disponible pour cette offre » par l'API. Selon la spécification, les offres France Travail ont `recipient_id` nul (redirection vers `apply.url` uniquement) ; le code plus récent de La bonne alternance lit désormais ces offres depuis sa base et pourrait leur donner un identifiant et un email de contact, ce qui reste à mesurer. Pour les partenaires par flux (Hellowork, RH Alternance, Monster, etc.) cela dépend de la présence d'un email de contact dans le flux. La part exacte n'est mesurable qu'avec une clé (voir F). Selon les combinaisons ROME/zone, la majorité des offres pourrait être dans ce cas. Cela touche le modèle de données (déjà prévu par `apply_channel = external_url`), l'écran de préparation, le suivi, et surtout le modèle économique (que facture-t-on ?).

**Options.**
1. Afficher toutes les offres. Pour celles sans `recipient_id`, la préparation génère la lettre adaptée, puis l'écran final propose « Candidater sur le site de l'offre » (ouverture de `apply.url`, lettre copiable, CV téléchargeable) et l'étudiant marque la candidature comme envoyée (`sent_via = manual`). Le crédit est débité au moment où l'étudiant confirme « J'ai envoyé ».
2. Idem, mais aucun crédit débité pour un envoi manuel (seul l'envoi API est facturé).
3. Masquer ces offres au MVP et ne montrer que les offres candidatables par l'API.

**Recommandation.** Option 1 : la valeur (lettre adaptée + fiche employeur) est la même quel que soit le canal, l'étudiant choisit en connaissance de cause, et le catalogue reste complet. Le badge « Candidature directe » distingue les offres candidatables par l'API. L'option 3 rendrait le produit inutilisable dans les zones où France Travail domine.

---

## B. Accords requis (écarts par rapport au brief, librairies hors stack)

| # | Sujet | Ce que dit le brief | Constat vérifié | Hypothèse par défaut |
|---|---|---|---|---|
| B1 | Trigger.dev | « Trigger.dev (v3) » et une route `/api/trigger` dans l'arborescence | La v3 est retirée (« Trigger.dev v3 has been retired ») ; SDK actuel 4.5.x ; aucune route Next.js n'est nécessaire, les tâches sont déclenchées par `tasks.trigger()` côté serveur | Trigger.dev v4, pas de `/api/trigger` |
| B2 | Extraction PDF et DOCX | Non précisé (« extraction du texte ») | Aucune lib de la stack ne lit un PDF. `unpdf` (unjs, MIT, build PDF.js sans binaire natif, Node >= 22) et `mammoth` (BSD, JS pur) sont maintenus et adaptés à Vercel / Trigger.dev. `pdf-parse` 2.x impose un binaire natif `@napi-rs/canvas` | Ajouter `unpdf` et `mammoth` ; justification : maintenus, sans dépendance native et adaptés au serverless (`pdf2json`, l'autre option sans dépendance, repose sur un fork ancien de PDF.js) |
| B3 | Génération de lettre | « Température basse (0.3) » | `claude-sonnet-5` renvoie 400 si `temperature`, `top_p` ou `top_k` est fixé ; le thinking adaptatif est actif par défaut | Pas de température ; `thinking: { type: "disabled" }` pour un rendu déterministe et un coût maîtrisé ; sobriété imposée par le system prompt ; sortie via structured outputs. Alternative si la qualité déçoit en test : thinking adaptatif avec `effort: "medium"` |
| B4 | API Adresse | `https://api-adresse.data.gouv.fr` | L'API Adresse de la BAN a été transférée à l'IGN (Géoplateforme). Le service historique répond encore mais son arrêt a été annoncé (redirection prévue jusqu'au 14 avril 2026, non effective au 9 septembre 2026, sans date garantie). Même contrat d'API sur `https://data.geopf.fr/geocodage` | Base URL Géoplateforme, ancien hôte non utilisé |
| B5 | Session Next.js | Non précisé | Next.js 16 renomme `middleware.ts` en `proxy.ts` (runtime Node.js obligatoire) ; pattern Supabase officiel `updateSession` + `getClaims()` | `proxy.ts` |
| B6 | Clés Supabase | Non précisé | Les clés `anon` / `service_role` sont dépréciées fin 2026 au profit des clés `sb_publishable_...` / `sb_secret_...` | Variables `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SECRET_KEY` |
| B7 | Logger | « utilise un logger » | Aucune lib de log dans la stack | Wrapper maison `lib/logger.ts` (JSON sur stdout, délègue au logger Trigger.dev dans les jobs). Pas de lib externe au MVP ; Sentry en phase 5 comme prévu |
| B8 | Zod | « Zod » | Zod 4 est la version courante (`zod` 4.5.x) ; API v4 (`z.email()`, `error:`) | Zod 4 |

---

## C. Questions non bloquantes, hypothèses par défaut

### Produit

| # | Question | Hypothèse par défaut | Raison |
|---|---|---|---|
| C1 | Nom du produit et domaine | `candidatly` partout jusqu'à décision ; le nom est une constante unique (`lib/brand.ts`) | Renommage sans risque |
| C2 | Prix TTC ou HT, TVA | Prix du brief affichés TTC ; Stripe Tax non activé au MVP ; mention « TTC » sur la page Crédits | Cible B2C en France |
| C3 | Moment du débit du crédit | À l'envoi API réussi (202), ou à la confirmation « J'ai envoyé » pour un envoi manuel ; jamais à la génération | Conforme au brief ; paramétrable si A1 impose de facturer la préparation |
| C4 | Valeurs de `applications.sent_via` | `api_alternance`, `manual`, `widget` (réserve), `gmail` (V2) | Couvre les options de A1 et A2 |
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
| C30 | Node.js | 24.x partout (local, Vercel, Trigger.dev `runtime: "node-24"`) ; `engines.node` dans `package.json` | Node 20 déprécié chez Vercel le 1er octobre 2026 |
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
| C47 | Autres ajouts | Valeur `unknown` de `applications.status` (C20), valeurs `manual` et `widget` de `sent_via` (C4), compteur de régénérations sur `applications` (C5), tables `offer_search_runs` (C29) et `stripe_events` (C36) | Regroupés ici pour la migration de la phase 1 |

---

## D. Comptes et accès à préparer (owner)

Aucun n'est nécessaire pour démarrer la phase 1 (Supabase local + réponses mockées), mais tous le sont avant la phase 2.

1. **API Alternance** : compte sur `https://api.apprentissage.beta.gouv.fr` (inscription gratuite par lien envoyé par email), puis deux jetons de 365 jours, non prolongeables. Un jeton **production** dans `API_ALTERNANCE_KEY` : la lecture des offres réelles ne demande aucune habilitation, alors qu'un jeton sandbox renvoie les offres de l'environnement de test, même en lecture. Un jeton **sandbox** dans `API_ALTERNANCE_SANDBOX_KEY` pour tester l'envoi de candidatures. Envoyer en parallèle l'email de A1 au support. Ne jamais partager un jeton (interdit par les CGU).
2. **Supabase** : projet cloud en région UE ; noter l'URL, la clé publishable et la clé secret.
3. **Google Cloud** : client OAuth 2.0 (type Web), URI de redirection `https://<project-ref>.supabase.co/auth/v1/callback`, écran de consentement ; client ID et secret à saisir dans Supabase Auth.
4. **Anthropic** : clé API dans `ANTHROPIC_API_KEY`, limite de dépense mensuelle configurée.
5. **Stripe** : compte en mode test (clés `sk_test_...`, secret de webhook), trois produits / prix pour les packs ; le passage en mode live exige une entité juridique.
6. **Trigger.dev** : projet cloud (plan Free : 10 schedules, concurrence limitée), clé `TRIGGER_SECRET_KEY`.
7. **Vercel** : projet lié au dépôt, Node 24.
8. **Machine locale** : Docker Desktop ou OrbStack pour `supabase start`, Stripe CLI.

---

## E. Versions et écarts de stack

Vérifiées le 9 septembre 2026 (`npm view <pkg> version` et documentation officielle). Le tableau des versions cibles est dans `CLAUDE.md` section 8. Points qui changent la manière de coder par rapport à un projet de 2025 :

- **Next.js 16.3** : `cookies()`, `headers()`, `params`, `searchParams` sont asynchrones ; `middleware.ts` devient `proxy.ts` (Node.js uniquement) ; Turbopack par défaut ; `next lint` supprimé (ESLint flat config appelé directement) ; `revalidateTag` prend un second argument ; `create-next-app` génère un `AGENTS.md` qui référence `CLAUDE.md`.
- **Supabase** : `@supabase/ssr` avec `getAll` / `setAll`, `getClaims()` dans le proxy (jamais `getSession()` côté serveur), `getUser()` quand il faut vérifier une déconnexion serveur ; `supabase-js` exige Node >= 22.
- **Trigger.dev 4.5** : `import { task, schedules } from "@trigger.dev/sdk"`, `schemaTask` + Zod, `idempotencyKey` (portée `run` par défaut depuis 4.3.1), files prédéfinies avec `queue()`, cron avec fuseau `Europe/Paris`.
- **Anthropic SDK 0.124** : structured outputs GA (`output_config.format`, helper `zodOutputFormat`, `client.messages.parse`), pas de contraintes numériques ni de longueur dans la grammaire (validées par Zod après coup), prompt caching à partir de 1 024 tokens (Sonnet 5) ou 4 096 (Haiku 4.5).
- **Stripe 22.6** : `new Stripe(secret)` (classe), `request.text()` pour le corps brut du webhook, `constructEvent`, `Idempotency-Key` sur la création de session.
- **Zod 4.5** : `import * as z from "zod"`, `z.email()`, `error:` au lieu de `message:`, `z.treeifyError()`.
- **Vitest 5** : `vi.mock` au niveau racine, `clearMocks` par défaut, Node >= 22.12.
- **TypeScript 7** est sorti (port natif) mais sans API programmatique stable ; typescript-eslint reste sur TS 6 (C31).

---

## F. À vérifier dès que les jetons existent (phase 1, avant la phase 2)

Les points 1 à 3 et 7 demandent le jeton production (données réelles), le point 5 le jeton sandbox ; les points 4 et 6 fonctionnent avec l'un ou l'autre.

1. Part des offres avec `apply.recipient_id` non nul, par `partner_label`, sur 5 couples ROME/zone représentatifs (décision A2).
2. Ordre réel des coordonnées dans `workplace.location.geopoint.coordinates` (GeoJSON attendu : `[longitude, latitude]`).
3. Présence de `identifier.id` et de `apply.recipient_id` sur les offres France Travail (la spécification dit nul ; le code récent de LBA lit ces offres depuis sa base).
4. En-têtes `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `retry-after` sur les réponses authentifiées, et code réel du dépassement (429 attendu, 419 dans le schéma).
5. Comportement de la sandbox pour `POST /job/v1/apply` : réponse 202, boîte de réception de l'environnement de recette, format exact de `recipient_id` (`partners_<id>` attendu).
6. Nombre maximal de codes ROME acceptés dans `romes` (aucune limite documentée).
7. Volume de résultats réel avec `radius = 30` et 3 codes ROME sur Paris, Lyon, une ville moyenne et une zone rurale (pour calibrer le score et la fréquence de sync).
8. Auprès du support : limite de 20 candidatures par jour et par SIRET pour une organisation multi-utilisateurs, engagement de maintien de la route `apply`, règles de conservation des données transmises.
