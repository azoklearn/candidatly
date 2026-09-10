-- Step 6 of the onboarding: 5 credits offered at sign-up (brief section 5.1).
-- Idempotent through the partial unique index credit_transactions_one_signup_bonus:
-- a second call, even concurrent, never credits twice. Returns the balance.

create or replace function public.grant_signup_bonus()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_inserted integer;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.credits (user_id) values (v_user) on conflict (user_id) do nothing;

  insert into public.credit_transactions (user_id, delta, reason)
  values (v_user, 5, 'signup_bonus')
  on conflict (user_id) where reason = 'signup_bonus' do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    update public.credits set balance = balance + 5 where user_id = v_user returning balance into v_balance;
  else
    select balance into v_balance from public.credits where user_id = v_user;
  end if;
  return v_balance;
end;
$$;

revoke execute on function public.grant_signup_bonus() from public, anon;
grant execute on function public.grant_signup_bonus() to authenticated;
