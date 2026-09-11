-- Companies that La bonne alternance flags as likely to hire apprentices in the searched
-- trades (the `recruiters` array of a search, docs/API_ALTERNANCE.md section 7.8). They have
-- no published offer: the interface proposes an unsolicited application (docs/QUESTIONS.md
-- C80). Stored per search key, replaced by every sync of that key, written by the service role.

create table public.hiring_companies (
  id uuid primary key default gen_random_uuid(),
  source public.offers_source not null,
  query_key text not null,
  external_id text not null,
  siret text,
  name text not null,
  naf_code text,
  naf_label text,
  headcount text,
  address text,
  lat double precision,
  lng double precision,
  apply_url text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hiring_companies_unique unique (source, query_key, external_id),
  constraint hiring_companies_siret_format check (siret is null or siret ~ '^[0-9]{14}$'),
  constraint hiring_companies_location_pair check ((lat is null) = (lng is null)),
  constraint hiring_companies_location_range check (
    (lat is null or lat between -90 and 90) and (lng is null or lng between -180 and 180)
  ),
  constraint hiring_companies_apply_url_format check (apply_url is null or apply_url ~ '^https?://')
);

create index hiring_companies_query_key_idx on public.hiring_companies (query_key);
create index hiring_companies_last_seen_idx on public.hiring_companies (last_seen_at);

create trigger set_updated_at before update on public.hiring_companies
  for each row execute function public.set_updated_at();

alter table public.hiring_companies enable row level security;
create policy hiring_companies_select_authenticated on public.hiring_companies
  for select to authenticated using (true);
revoke all on public.hiring_companies from anon;
revoke insert, update, delete on public.hiring_companies from authenticated;
