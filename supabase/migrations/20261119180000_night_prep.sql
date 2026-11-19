-- Night preparation (docs/QUESTIONS.md C123): for students who asked for it, the letter of
-- their best new offers is prepared each night; they read and send in the morning. Nothing
-- is sent by the service. Same scheduling pattern as the offer sync: the site URL and the
-- shared secret come from Supabase Vault, and the job does nothing without them.

alter table public.profiles
  add column night_prep_enabled boolean not null default false;
grant update (night_prep_enabled) on public.profiles to authenticated;

alter table public.applications
  add column prepared_at_night boolean not null default false;

create or replace function public.invoke_night_prep()
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
    url := rtrim(site_url, '/') || '/api/cron/night-prep',
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

revoke execute on function public.invoke_night_prep() from public, anon, authenticated;

-- 03:30 UTC: 04:30 in Paris in winter, 05:30 in summer.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule(
      'candidatly-night-prep',
      '30 3 * * *',
      'select public.invoke_night_prep()'
    );
  end if;
end
$$;
