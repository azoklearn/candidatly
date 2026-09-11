-- Scheduled offer sync with Supabase Cron (docs/QUESTIONS.md B10), replacing Trigger.dev.
-- Every 15 minutes the database calls the protected route /api/cron/sync-offers of the
-- site, which refreshes a batch of searches older than 6 hours. The site URL and the
-- shared secret live in Supabase Vault (candidatly_site_url, candidatly_cron_secret; see
-- docs/RUNBOOK.md): this migration holds no secret, and the job does nothing without them.

-- Extensions are created only where they exist (not in the PGlite test database).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
  end if;
end
$$;

create or replace function public.invoke_offer_sync()
returns text
language plpgsql
set search_path = ''
as $$
declare
  site_url text;
  cron_secret text;
begin
  select decrypted_secret into site_url
  from vault.decrypted_secrets where name = 'candidatly_site_url';
  select decrypted_secret into cron_secret
  from vault.decrypted_secrets where name = 'candidatly_cron_secret';
  if site_url is null or cron_secret is null then
    return 'not_configured';
  end if;
  perform net.http_post(
    url := rtrim(site_url, '/') || '/api/cron/sync-offers',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    timeout_milliseconds := 60000
  );
  return 'requested';
end
$$;

revoke execute on function public.invoke_offer_sync() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule(
      'candidatly-sync-offers',
      '*/15 * * * *',
      'select public.invoke_offer_sync()'
    );
  end if;
end
$$;
