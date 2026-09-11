-- Cache of company searches (docs/QUESTIONS.md C62), negative results included, so an
-- employer that cannot be identified is not searched again for 30 days. The key is
-- "siret:<siret>" or "name:<normalised name>|<postal code>". Written by the service role.

create table public.company_lookups (
  key text primary key,
  siret text,
  status text not null,
  confidence numeric(3, 2),
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_lookups_key_format check (key ~ '^(siret|name):'),
  constraint company_lookups_status_values check (status in ('found', 'not_found', 'low_confidence')),
  constraint company_lookups_siret_format check (siret is null or siret ~ '^[0-9]{14}$'),
  constraint company_lookups_found_has_siret check (status <> 'found' or siret is not null),
  constraint company_lookups_confidence_range check (confidence is null or confidence between 0 and 1)
);

create trigger set_updated_at before update on public.company_lookups
  for each row execute function public.set_updated_at();

alter table public.company_lookups enable row level security;
create policy company_lookups_select_authenticated on public.company_lookups
  for select to authenticated using (true);
revoke all on public.company_lookups from anon;
revoke insert, update, delete on public.company_lookups from authenticated;

-- Employers of live offers still to identify, for the scheduled sync (at most 50 per call).
create or replace function public.pending_company_sirets(p_limit integer default 10)
returns table (
  siret text,
  company_name text,
  company_website text,
  postal_code text,
  company_description text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (o.company_siret)
    o.company_siret, o.company_name, o.company_website, o.postal_code,
    o.raw #>> '{workplace,description}'
  from public.offers o
  where o.company_siret is not null
    and o.removed_at is null
    and not o.is_delegated
    and not exists (
      select 1 from public.companies c
      where c.siret = o.company_siret and c.updated_at > now() - interval '30 days'
    )
    and not exists (
      select 1 from public.company_lookups l
      where l.key = 'siret:' || o.company_siret and l.checked_at > now() - interval '30 days'
    )
  order by o.company_siret, o.last_seen_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

revoke execute on function public.pending_company_sirets(integer) from public, anon, authenticated;
grant execute on function public.pending_company_sirets(integer) to service_role;
