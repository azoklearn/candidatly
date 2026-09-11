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

## Mettre le MVP en ligne

1. **Vercel.** Créer le projet depuis le dépôt, Node 24. Variables d'environnement : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (adresse publique du site), `SUPABASE_SECRET_KEY`, `API_ALTERNANCE_KEY`, `CRON_SECRET`. Facultatives : `LOG_LEVEL`, `GEOCODING_API_BASE_URL`, `RECHERCHE_ENTREPRISES_BASE_URL`.
2. **Supabase, authentification.** Dans Authentication > URL Configuration : Site URL égale à l'adresse publique ; ajouter `<site>/auth/callback` et `<site>/auth/confirm` aux Redirect URLs. Recopier le modèle d'email de `supabase/templates/confirmation.html`. Activer Google seulement avec un client OAuth configuré.
3. **Supabase, base.** Les migrations sont déjà appliquées au projet lié (`npm run db:push` pour les suivantes). Enregistrer dans Vault l'adresse du site et le secret de la synchronisation (section précédente).
4. **Pages légales.** Remplacer les repères entre crochets des pages `/mentions-legales`, `/confidentialite` et `/conditions` (identité de l'éditeur, contact, hébergeur), puis les faire relire.
5. **Vérifier.** Créer un compte, finir l'inscription, ouvrir une offre, préparer une candidature, confirmer l'envoi, exporter ses données, supprimer le compte. Contrôler après un quart d'heure la synchronisation (`cron.job_run_details`) et le lendemain la tâche `candidatly-daily-maintenance`.
