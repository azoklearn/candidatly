-- Accent-insensitive search on the ROME reference (docs/ROME.md section 11.3).
-- search_text is lower-case and accent-free, filled by scripts/import-rome.ts.

alter table public.rome_codes add column search_text text not null default '';
alter table public.rome_appellations add column search_text text not null default '';
alter table public.rome_codes
  add column search_vector tsvector generated always as (to_tsvector('simple', search_text)) stored;
alter table public.rome_appellations
  add column search_vector tsvector generated always as (to_tsvector('simple', search_text)) stored;
create index rome_codes_search_idx on public.rome_codes using gin (search_vector);
create index rome_appellations_search_idx on public.rome_appellations using gin (search_vector);

-- Candidate ROME codes for normalised search terms (prefix match on every term).
-- Rarely used appellations weigh half; a match on the code label weighs double.
create or replace function public.search_rome_candidates(p_terms text[], p_limit integer default 30)
returns table (code text, label text, appellations text[], rank real)
language sql
stable
security invoker
set search_path = ''
as $$
  with query as (
    select to_tsquery('simple', string_agg(quote_literal(term) || ':*', ' | ')) as tsq
    from unnest(p_terms) as term
    where term ~ '^[a-z0-9]{2,}$'
  ),
  hits as (
    select a.code_rome as code, a.label_long as matched,
      ts_rank(a.search_vector, query.tsq) * (case when a.peu_usite then 0.5 else 1 end) as score
    from public.rome_appellations a, query
    where a.is_active and a.search_vector @@ query.tsq
    union all
    select c.code, c.label, ts_rank(c.search_vector, query.tsq) * 2
    from public.rome_codes c, query
    where c.is_active and c.search_vector @@ query.tsq
  )
  select c.code, c.label,
    (array_agg(distinct hits.matched))[1:5] as appellations,
    sum(hits.score)::real as rank
  from hits
  join public.rome_codes c on c.code = hits.code and c.is_active
  group by c.code, c.label
  order by rank desc, c.code
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

revoke execute on function public.search_rome_candidates(text[], integer) from public, anon;
grant execute on function public.search_rome_candidates(text[], integer) to authenticated, service_role;
