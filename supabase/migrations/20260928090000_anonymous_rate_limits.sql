-- Rate limits for visitors, who have no auth.uid() (docs/QUESTIONS.md C91): the
-- questionnaire is open before the account exists. The key is a keyed hash of the caller's
-- address computed by the application; no address is ever stored. Only the service role
-- may call the function.

create table public.anon_rate_limits (
  client_hash text not null,
  action text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (client_hash, action, window_start)
);
alter table public.anon_rate_limits enable row level security;
revoke all on public.anon_rate_limits from anon, authenticated;

create or replace function public.check_anon_rate_limit(p_client_hash text, p_action text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket timestamptz;
  total integer;
begin
  if p_client_hash !~ '^[a-f0-9]{16,64}$' then
    raise exception 'invalid client hash';
  end if;
  if p_action !~ '^[a-z_]{1,40}$' or p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit arguments';
  end if;
  bucket := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.anon_rate_limits as r (client_hash, action, window_start, hits)
  values (p_client_hash, p_action, bucket, 1)
  on conflict (client_hash, action, window_start) do update set hits = r.hits + 1
  returning hits into total;
  return total <= p_limit;
end
$$;
revoke execute on function public.check_anon_rate_limit(text, text, integer, integer) from public, anon, authenticated;

-- The daily clean-up also purges the visitor counters.
create or replace function public.daily_maintenance()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  unanswered integer;
  purged integer;
  purged_anon integer;
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
  delete from public.anon_rate_limits where window_start < now() - interval '2 days';
  get diagnostics purged_anon = row_count;
  return jsonb_build_object('unanswered', unanswered, 'purged', purged, 'purged_anon', purged_anon);
end
$$;
revoke execute on function public.daily_maintenance() from public, anon, authenticated;
