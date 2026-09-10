-- Core tables from docs/BRIEF.md section 4, with the additions recorded in
-- docs/QUESTIONS.md (C42 to C47). Every table has a uuid id, created_at and updated_at.

-- One row per user, created by the auth bootstrap trigger.
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  school text,
  degree_label text,
  diploma_level public.profiles_diploma_level,
  target_contract public.profiles_target_contract not null default 'alternance',
  domain_free_text text,
  rome_codes text[] not null default '{}',
  rome_version integer,
  location_label text,
  location_lat double precision,
  location_lng double precision,
  insee_code text,
  search_radius_km integer not null default 30,
  availability_date date,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_rome_codes_format check (
    array_to_string(rome_codes, ',') ~ '^([A-Z][0-9]{4}(,[A-Z][0-9]{4})*)?$'
    and array_position(rome_codes, null::text) is null
  ),
  constraint profiles_rome_codes_count check (cardinality(rome_codes) <= 5),
  constraint profiles_onboarding_requires_rome check (not onboarding_completed or cardinality(rome_codes) >= 1),
  constraint profiles_search_radius_range check (search_radius_km between 1 and 200),
  constraint profiles_location_pair check ((location_lat is null) = (location_lng is null)),
  constraint profiles_location_range check (
    (location_lat is null or location_lat between -90 and 90)
    and (location_lng is null or location_lng between -180 and 180)
  ),
  constraint profiles_insee_code_format check (insee_code is null or insee_code ~ '^[0-9][0-9AB][0-9]{3}$')
);
comment on column public.profiles.diploma_level is 'Level of the diploma prepared during the apprenticeship (target level), see docs/QUESTIONS.md C6.';
comment on column public.profiles.rome_version is 'ROME nomenclature version used when rome_codes were chosen.';

-- CV and base cover letter. A pasted letter has no file (storage_path null).
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.documents_kind not null,
  storage_path text,
  original_filename text,
  mime_type text,
  size_bytes integer,
  extracted_text text,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_storage_path_owner check (storage_path is null or storage_path like (user_id::text || '/%')),
  constraint documents_cv_has_file check (kind <> 'cv' or storage_path is not null),
  constraint documents_size_positive check (size_bytes is null or size_bytes > 0)
);
create unique index documents_one_current_per_kind on public.documents (user_id, kind) where is_current;
create index documents_user_idx on public.documents (user_id);

-- Normalised cache of external offers, shared by all users.
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  source public.offers_source not null,
  external_id text not null,
  title text not null,
  description text,
  contract_types text[] not null default '{}',
  diploma_level smallint,
  company_name text,
  company_siret text,
  company_website text,
  is_delegated boolean not null default false,
  location_label text,
  postal_code text,
  lat double precision,
  lng double precision,
  insee_code text,
  rome_codes text[] not null default '{}',
  published_at timestamptz,
  expires_at timestamptz,
  apply_channel public.offers_apply_channel not null,
  apply_target text not null,
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz,
  raw jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_source_external_id_key unique (source, external_id),
  constraint offers_diploma_level_range check (diploma_level is null or diploma_level between 3 and 7),
  constraint offers_company_siret_format check (company_siret is null or company_siret ~ '^[0-9]{14}$'),
  constraint offers_postal_code_format check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  constraint offers_location_pair check ((lat is null) = (lng is null))
);
comment on column public.offers.external_id is 'API Alternance: <partner_label>:<partner_job_id>.';
comment on column public.offers.diploma_level is 'Targeted European qualification level (3 to 7), as target_diploma.european in the API Alternance.';
comment on column public.offers.is_delegated is 'True when the offer is managed by a school: the workplace fields then describe the school.';
comment on column public.offers.apply_target is 'recipient_id for the api_alternance channel, application URL for external_url, address for email.';
comment on column public.offers.removed_at is 'Logical deletion: expired or no longer returned by the source.';
create index offers_rome_codes_idx on public.offers using gin (rome_codes);
create index offers_live_expires_idx on public.offers (expires_at) where removed_at is null;
create index offers_company_siret_idx on public.offers (company_siret);

-- Employer card, shared by all users.
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  siret text not null unique,
  siren text not null,
  legal_name text,
  brand_name text,
  naf_code text,
  naf_label text,
  naf25_code text,
  headcount_range text,
  date_creation date,
  address text,
  postal_code text,
  city text,
  establishment_address text,
  establishment_postal_code text,
  establishment_city text,
  website text,
  executives jsonb not null default '[]'::jsonb,
  confidence numeric(3, 2),
  summary jsonb,
  summary_generated_at timestamptz,
  source_updated_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_siret_format check (siret ~ '^[0-9]{14}$'),
  constraint companies_siren_format check (siren ~ '^[0-9]{9}$'),
  constraint companies_siren_matches_siret check (siren = left(siret, 9)),
  constraint companies_confidence_range check (confidence is null or confidence between 0 and 1),
  constraint companies_executives_is_array check (jsonb_typeof(executives) = 'array')
);
comment on column public.companies.address is 'Head office address (siege), per brief section 3.2.';
comment on column public.companies.establishment_address is 'Workplace establishment address when it differs from the head office.';
comment on column public.companies.executives is 'Array of { nom, prenoms, qualite } for natural persons only. Never birth dates or nationality.';

-- An offer proposed to a user.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  offer_id uuid not null references public.offers (id) on delete cascade,
  score numeric(5, 2) not null,
  score_reasons jsonb not null default '{}'::jsonb,
  status public.matches_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_user_offer_key unique (user_id, offer_id),
  constraint matches_score_range check (score between 0 and 100)
);
create index matches_user_score_idx on public.matches (user_id, score desc);
create index matches_offer_idx on public.matches (offer_id);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  offer_id uuid not null references public.offers (id) on delete restrict,
  match_id uuid references public.matches (id) on delete set null,
  cover_letter_text text,
  cover_letter_diff jsonb,
  generation_model text,
  generation_tokens jsonb,
  regeneration_count smallint not null default 0,
  status public.applications_status not null default 'draft',
  sent_at timestamptz,
  sent_via public.applications_sent_via,
  external_application_id text,
  next_follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_user_offer_key unique (user_id, offer_id),
  constraint applications_regeneration_limit check (regeneration_count between 0 and 3),
  constraint applications_sent_fields check (status in ('draft', 'ready') or (sent_at is not null and sent_via is not null))
);
comment on column public.applications.generation_tokens is 'LLM usage: { "input_tokens": int, "output_tokens": int }.';
comment on column public.applications.regeneration_count is 'Manual regenerations used, at most 3 (brief section 5.4).';
create index applications_user_status_idx on public.applications (user_id, status);
create index applications_follow_up_idx on public.applications (next_follow_up_at) where status = 'sent';

create table public.credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credits_balance_non_negative check (balance >= 0)
);

-- Append-only credit ledger; partial unique indexes make every movement idempotent.
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  reason public.credit_transactions_reason not null,
  application_id uuid references public.applications (id) on delete set null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_transactions_delta_non_zero check (delta <> 0),
  constraint credit_transactions_purchase_has_session check (reason <> 'purchase' or stripe_checkout_session_id is not null)
);
create unique index credit_transactions_one_debit_per_application on public.credit_transactions (application_id) where reason = 'application_sent';
create unique index credit_transactions_one_refund_per_application on public.credit_transactions (application_id) where reason = 'refund';
create unique index credit_transactions_one_signup_bonus on public.credit_transactions (user_id) where reason = 'signup_bonus';
create unique index credit_transactions_checkout_session_key on public.credit_transactions (stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create index credit_transactions_user_idx on public.credit_transactions (user_id, created_at desc);

-- Light audit trail.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_user_idx on public.events (user_id, created_at desc);
create index events_type_idx on public.events (type, created_at desc);

-- One row per external search, for the 6 h cache and quota monitoring (C29).
create table public.offer_search_runs (
  id uuid primary key default gen_random_uuid(),
  source public.offers_source not null,
  query_key text not null,
  params jsonb not null,
  fetched_at timestamptz not null default now(),
  status_code integer,
  result_count integer,
  warnings jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index offer_search_runs_key_idx on public.offer_search_runs (source, query_key, fetched_at desc);

-- Processed Stripe webhook events, for idempotency (C36).
create table public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  type text not null,
  processed_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Premium subscription status, pending the pricing decision (A5).
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  plan text not null,
  status public.subscriptions_status not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id);

create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.documents for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.offers for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.matches for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.applications for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.credits for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.credit_transactions for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.offer_search_runs for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.stripe_events for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
