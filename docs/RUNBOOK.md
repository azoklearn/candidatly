# Runbook Candidatly

Document d'exploitation. Il sera complété en phase 5 (déploiement, variables d'environnement, conduite à tenir si l'API Alternance tombe). Pour l'instant, il suit les échéances des jetons et la synchronisation planifiée des offres.

## Jetons et échéances

| Service | Variable | Type | Créé le | Expire le | Stockage |
|---|---|---|---|---|---|
| API Alternance | `API_ALTERNANCE_KEY` | Production, lecture seule : le compte n'est rattaché à aucune organisation, donc sans habilitation d'envoi | 10 septembre 2026 | 10 septembre 2027 | `.env.local` sur le poste de développement ; Vercel au déploiement |
| API Alternance | `API_ALTERNANCE_SANDBOX_KEY` | Sandbox, pour tester l'envoi | À créer | | |

## Renouveler un jeton API Alternance

1. Le portail envoie une alerte par email 30 jours puis 15 jours avant l'échéance, à l'adresse du compte.
2. Un jeton ne se prolonge pas : en générer un nouveau sur https://api.apprentissage.beta.gouv.fr/fr/compte/profil.
3. Remplacer la valeur partout où elle est stockée (`.env.local`, Vercel), redéployer, vérifier une recherche, puis supprimer l'ancien jeton sur le portail.
4. Mettre à jour le tableau ci-dessus.

Ne jamais coller un jeton dans un ticket, un commit, un log ou une conversation : les CGU du portail interdisent toute divulgation.

## Synchronisation planifiée des offres

Supabase Cron lance toutes les 15 minutes la fonction `public.invoke_offer_sync()`, qui appelle `POST <site>/api/cron/sync-offers` avec le secret partagé. Chaque appel met à jour au plus 25 recherches vieilles de plus de 6 heures, recalcule les correspondances des étudiants concernés et retire les offres périmées. Tant que les deux secrets ci-dessous manquent dans Vault, la tâche tourne sans rien appeler : c'est le cas du projet de développement, qui n'a pas de site déployé.

État : en service depuis le 11 septembre 2026 sur le projet `ylupsjydkbmryctfrfte`, avec `candidatly_site_url` = `https://www.candidatly.app` (premier appel accepté à 16 h 34 UTC). Un 401 dans `net._http_response` signifie que le secret de Vault diffère de `CRON_SECRET` sur Vercel.

Mise en service, une fois le site déployé :

1. Générer un secret d'au moins 32 caractères (`openssl rand -hex 32`) et le mettre dans la variable `CRON_SECRET` de Vercel.
2. Dans l'éditeur SQL de Supabase, enregistrer l'adresse du site et le même secret :

   ```sql
   select vault.create_secret('https://<domaine-du-site>', 'candidatly_site_url');
   select vault.create_secret('<le-secret>', 'candidatly_cron_secret');
   ```

3. Contrôler après un quart d'heure :

   ```sql
   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
   select status_code, content, created from net._http_response order by created desc limit 5;
   ```

Changer le secret : `select vault.update_secret((select id from vault.secrets where name = 'candidatly_cron_secret'), '<nouveau>');`, puis mettre la même valeur dans Vercel et redéployer.

Lancer une synchronisation à la main, en local avec `npm run dev` et la valeur de `CRON_SECRET` de `.env.local` :

```bash
curl -X POST http://localhost:3000/api/cron/sync-offers -H "Authorization: Bearer <CRON_SECRET>"
```

## Paiements Whop

Les forfaits se paient sur Whop (`docs/QUESTIONS.md` C83). Tant que `WHOP_API_KEY` et `WHOP_WEBHOOK_SECRET` manquent, il n'y a pas de mur de paiement : chaque étudiant garde l'accès complet.

Mise en service :

1. **Whop** : créer le compte et l'entreprise sur whop.com, puis renseigner les informations de versement demandées par Whop.
2. **Clé d'API** : Dashboard > Developer > créer une clé « Account API key » (rôle Admin), la copier dans `.env.local` sous `WHOP_API_KEY`. Ne jamais la coller dans une conversation.
3. **Plans** : l'owner a créé les produits et les plans dans le tableau de bord Whop (11 septembre 2026). Chacun doit être un abonnement en euros au prix de `lib/pricing.ts` : 9,99 €, 14,99 €, 19,99 € tous les 30 jours ; 99,90 €, 149,90 €, 199,90 € tous les 365 jours. Après tout changement de prix, corriger les plans dans Whop puis relancer `npm run whop:setup` : tant que le prix relié diffère du prix affiché, le paiement refuse de démarrer (`billing_plan_price_mismatch` dans les logs) plutôt que de débiter un autre montant.
4. **Liaison et webhook** : `npm run whop:setup -- --dry-run` liste les plans Whop et montre à quel forfait chacun est relié, sans rien écrire. Puis `npm run whop:setup` enregistre les six liaisons dans `billing_plans`, crée le webhook `https://www.candidatly.app/api/whop/webhook` (événements `membership.activated`, `membership.deactivated`, `membership.cancel_at_period_end_changed`, `payment.succeeded`, `payment.failed`) et écrit `WHOP_WEBHOOK_SECRET` dans `.env.local`. Un plan à un autre prix ou à une autre période n'est pas relié : corriger le plan dans Whop, ou nommer les plans avec `--map=basic:monthly=plan_...,plus:annual=plan_...`. Relançable sans doublon.
5. **Vercel** : ajouter `WHOP_API_KEY` et `WHOP_WEBHOOK_SECRET`, redéployer. Le mur de paiement s'active.
6. **Vérifier** : choisir un forfait avec un compte de test, payer, revenir sur `/forfait/merci` : la page ouvre les offres dès que le webhook a enregistré l'abonnement. Contrôle en base : `select plan, status, current_period_end from subscriptions order by updated_at desc limit 5;`.

Donner l'accès complet à un compte sans abonnement (owner, testeurs) : `update profiles set billing_exempt = true where email = '<adresse>';` dans l'éditeur SQL de Supabase.

Si un paiement n'active rien : `select type, processed_at, created_at from billing_events order by created_at desc limit 10;`. Un événement sans `processed_at` a échoué et Whop le renvoie pendant 3 jours ; une adhésion achetée hors du site (sans métadonnée `user_id`) est ignorée et journalisée `membership_not_linked`.

## Mettre le MVP en ligne

Adresse publique depuis le 11 septembre 2026 : https://candidatly.app (DNS chez Vercel), qui redirige vers https://www.candidatly.app. Utilisez l'adresse `www` partout où une adresse est demandée : `NEXT_PUBLIC_SITE_URL`, Site URL de Supabase, secret Vault `candidatly_site_url`. Les Redirect URLs de Supabase doivent lister `/auth/callback` et `/auth/confirm` pour `https://www.candidatly.app` et pour `https://candidatly.vercel.app`, qui reste active.

1. **Vercel.** Créer le projet depuis le dépôt, Node 24. Variables d'environnement : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (adresse publique du site), `SUPABASE_SECRET_KEY`, `API_ALTERNANCE_KEY`, `CRON_SECRET`. Facultatives : `LOG_LEVEL`, `GEOCODING_API_BASE_URL`, `RECHERCHE_ENTREPRISES_BASE_URL`.
2. **Supabase, authentification.** Dans Authentication > URL Configuration : Site URL égale à l'adresse publique ; ajouter `<site>/auth/callback` et `<site>/auth/confirm` aux Redirect URLs. Recopier le modèle d'email de `supabase/templates/confirmation.html`. Activer Google seulement avec un client OAuth configuré.
3. **Supabase, base.** Les migrations sont déjà appliquées au projet lié (`npm run db:push` pour les suivantes). Enregistrer dans Vault l'adresse du site et le secret de la synchronisation (section précédente).
4. **Pages légales.** Remplacer les repères entre crochets des pages `/mentions-legales`, `/confidentialite` et `/conditions` (identité de l'éditeur, contact, hébergeur), puis les faire relire.
5. **Vérifier.** Créer un compte, finir l'inscription, ouvrir une offre, préparer une candidature, confirmer l'envoi, exporter ses données, supprimer le compte. Contrôler après un quart d'heure la synchronisation (`cron.job_run_details`) et le lendemain la tâche `candidatly-daily-maintenance`.

## Activer la connexion avec Google

Le bouton « Continuer avec Google » n'apparaît que si Google est activé dans le projet Supabase (lecture en direct, mise à jour sous 5 minutes).

1. **Google Cloud Console** (console.cloud.google.com), projet de votre choix : APIs et services > Écran de consentement OAuth, type « Externe », nom Candidatly, email de contact.
2. APIs et services > Identifiants > Créer des identifiants > ID client OAuth, type « Application Web ». URI de redirection autorisé : `https://ylupsjydkbmryctfrfte.supabase.co/auth/v1/callback`.
3. **Supabase** : Authentication > Sign In / Providers > Google : activer, coller l'ID client et le code secret générés à l'étape 2, enregistrer. Ne jamais les coller dans une conversation ni dans le dépôt.
4. **Supabase** : Authentication > URL Configuration : Site URL égale à l'adresse du site, et dans Redirect URLs, `<site>/auth/callback` pour chaque adresse utilisée (`http://localhost:3000` en local, l'adresse Vercel en ligne).

## « La connexion est indisponible : ce site n'est pas encore relié à sa base de données »

Ce message signifie que `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` manque sur l'environnement. En local : fichier `.env.local` à la racine du projet, puis relancer `npm run dev`. Sur Vercel : Settings > Environment Variables, puis redéployer, car les variables `NEXT_PUBLIC_` sont figées au build.

## Confirmation des emails à l'inscription

Supprimée définitivement le 11 septembre 2026 (C79). L'inscription connecte directement l'étudiant et l'envoie au questionnaire, sans email. Le code ne dépend pas du réglage Supabase : si « Confirm email » est coché, le serveur confirme lui-même chaque nouveau compte. Le décocher reste conseillé (Authentication > Sign In / Providers > Email) pour que Supabase n'essaie pas d'envoyer d'email.

Un compte resté non confirmé d'avant cette décision se débloque dans Authentication > Users, ou par l'API d'administration.
