-- Better ranking for search_rome_candidates. The first version summed the scores of
-- every matching title, so a frequent word ("developpement") outweighed a decisive
-- rare one ("web") and codes with many titles won. Now each term is weighted by its
-- rarity (inverse document frequency), a code is ranked by its best matching title,
-- and the number of matching titles only breaks ties.

create or replace function public.search_rome_candidates(p_terms text[], p_limit integer default 30)
returns table (code text, label text, appellations text[], rank real)
language sql
stable
security invoker
set search_path = ''
as $$
  with terms as (
    select distinct term, to_tsquery('simple', quote_literal(term) || ':*') as tsq
    from unnest(p_terms) as term
    where term ~ '^[a-z0-9]{2,}$'
  ),
  docs as (
    select a.code_rome as code, a.label_long as label, a.search_vector as vector,
      case when a.peu_usite then 0.5 else 1.0 end as weight, false as is_code
    from public.rome_appellations a
    where a.is_active
    union all
    select c.code, c.label, c.search_vector, 1.2, true
    from public.rome_codes c
    where c.is_active
  ),
  term_hits as (
    select t.term, d.code, d.label, d.weight, d.is_code
    from terms t
    join docs d on d.vector @@ t.tsq
  ),
  idf as (
    select term, ln(1 + (select count(*) from docs)::float8 / count(*)) as weight
    from term_hits
    group by term
  ),
  doc_scores as (
    select h.code, h.label, h.is_code, max(h.weight) * sum(i.weight) as doc_score
    from term_hits h
    join idf i using (term)
    group by h.code, h.label, h.is_code
  ),
  code_scores as (
    select code,
      max(doc_score) + 0.1 * ln(count(*)) as score,
      (array_agg(label order by doc_score desc, label) filter (where not is_code))[1:5] as appellations
    from doc_scores
    group by code
  )
  select c.code, c.label, coalesce(s.appellations, '{}'), s.score::real
  from code_scores s
  join public.rome_codes c on c.code = s.code and c.is_active
  order by s.score desc, c.code
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

revoke execute on function public.search_rome_candidates(text[], integer) from public, anon;
grant execute on function public.search_rome_candidates(text[], integer) to authenticated, service_role;
