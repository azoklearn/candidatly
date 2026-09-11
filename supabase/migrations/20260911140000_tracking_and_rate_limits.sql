-- MVP tracking and abuse protection (docs/QUESTIONS.md C67 and C68).
-- 1. check_rate_limit: fixed-window counter per signed-in user and action, callable by
--    the user's own session only (the key comes from auth.uid(), never from the caller).
-- 2. daily_maintenance: marks applications without answer after 14 days as no_answer
--    (brief section 6, schedule-follow-ups) and purges old rate-limit counters.

create table public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, action, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(p_action text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  bucket timestamptz;
  total integer;
begin
  if uid is null then
    return false;
  end if;
  if p_action !~ '^[a-z_]{1,40}$' or p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit arguments';
  end if;
  bucket := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (user_id, action, window_start, hits)
  values (uid, p_action, bucket, 1)
  on conflict (user_id, action, window_start) do update set hits = r.hits + 1
  returning hits into total;
  return total <= p_limit;
end
$$;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;

create or replace function public.daily_maintenance()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  unanswered integer;
  purged integer;
begin
  with updated as (
    update public.applications
    set status = 'no_answer', next_follow_up_at = null
    where status in ('sent', 'viewed') and sent_at < now() - interval '14 days'
    returning id, user_id
  ), logged as (
    insert into public.events (user_id, type, payload)
    select user_id, 'application_status',
      jsonb_build_object('application_id', id, 'status', 'no_answer', 'by', 'system')
    from updated
    returning 1
  )
  select count(*) into unanswered from logged;
  delete from public.rate_limits where window_start < now() - interval '2 days';
  get diagnostics purged = row_count;
  return jsonb_build_object('unanswered', unanswered, 'purged', purged);
end
$$;
revoke execute on function public.daily_maintenance() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('candidatly-daily-maintenance', '0 5 * * *', 'select public.daily_maintenance()');
  end if;
end
$$;
