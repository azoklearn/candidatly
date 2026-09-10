-- Row Level Security on every table (brief section 4).
-- Users only see their own rows. Shared caches (offers, companies) are read-only
-- for signed-in users. Writes that matter (credits, sending, scores) go through
-- the service role or dedicated functions, never through direct table updates.

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.offers enable row level security;
alter table public.companies enable row level security;
alter table public.matches enable row level security;
alter table public.applications enable row level security;
alter table public.credits enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.events enable row level security;
alter table public.offer_search_runs enable row level security;
alter table public.stripe_events enable row level security;
alter table public.subscriptions enable row level security;

-- The anonymous role never touches application tables.
revoke all on table
  public.profiles, public.documents, public.offers, public.companies, public.matches,
  public.applications, public.credits, public.credit_transactions, public.events,
  public.offer_search_runs, public.stripe_events, public.subscriptions
from anon;

-- Service-only tables: RLS on, no policy, no grant.
revoke all on table public.offer_search_runs, public.stripe_events from authenticated;

-- profiles: read and update own row, on user-editable columns only.
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.profiles from authenticated;
grant update (
  first_name, last_name, phone, school, degree_label, diploma_level, target_contract,
  domain_free_text, rome_codes, rome_version, location_label, location_lat, location_lng,
  insee_code, search_radius_km, availability_date, onboarding_completed
) on public.profiles to authenticated;

-- documents: full control over own rows.
create policy documents_select_own on public.documents
  for select to authenticated using (user_id = (select auth.uid()));
create policy documents_insert_own on public.documents
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy documents_update_own on public.documents
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy documents_delete_own on public.documents
  for delete to authenticated using (user_id = (select auth.uid()));

-- offers and companies: shared read-only caches.
create policy offers_select_authenticated on public.offers
  for select to authenticated using (true);
create policy companies_select_authenticated on public.companies
  for select to authenticated using (true);
revoke insert, update, delete on public.offers, public.companies from authenticated;

-- matches: read own, change only the status (save, dismiss).
create policy matches_select_own on public.matches
  for select to authenticated using (user_id = (select auth.uid()));
create policy matches_update_own on public.matches
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.matches from authenticated;
grant update (status) on public.matches to authenticated;

-- applications: read own, edit only the letter and the notes. Status changes
-- (sending, replies) go through dedicated functions in phase 4.
create policy applications_select_own on public.applications
  for select to authenticated using (user_id = (select auth.uid()));
create policy applications_update_own on public.applications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.applications from authenticated;
grant update (cover_letter_text, notes) on public.applications to authenticated;

-- credits, ledger, events, subscriptions: read own rows only.
create policy credits_select_own on public.credits
  for select to authenticated using (user_id = (select auth.uid()));
create policy credit_transactions_select_own on public.credit_transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy events_select_own on public.events
  for select to authenticated using (user_id = (select auth.uid()));
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.credits, public.credit_transactions, public.events, public.subscriptions from authenticated;
