-- Payments through Whop (docs/QUESTIONS.md C83), instead of the Stripe plan of the brief.
-- Nothing was ever written to the Stripe-shaped tables, so they are reshaped in place.

-- 1. Memberships bought on Whop, one row per membership, written by the webhook (service role).
alter table public.subscriptions rename column stripe_subscription_id to provider_subscription_id;
alter table public.subscriptions rename column stripe_customer_id to provider_customer_id;
alter table public.subscriptions rename constraint subscriptions_stripe_subscription_id_key
  to subscriptions_provider_subscription_id_key;
alter table public.subscriptions alter column provider_customer_id drop not null;
alter table public.subscriptions alter column status type text using status::text;
drop type public.subscriptions_status;
alter table public.subscriptions
  add column provider text not null default 'whop',
  add column billing text,
  add column manage_url text,
  add constraint subscriptions_provider_values check (provider in ('whop')),
  add constraint subscriptions_status_values check (status in (
    'trialing', 'active', 'past_due', 'completed', 'canceled', 'expired', 'unresolved',
    'drafted', 'canceling'
  )),
  add constraint subscriptions_plan_values check (plan in ('basic', 'plus', 'premium')),
  add constraint subscriptions_billing_values
    check (billing is null or billing in ('monthly', 'annual')),
  add constraint subscriptions_manage_url_format
    check (manage_url is null or manage_url ~ '^https://');

-- 2. Webhook deliveries already handled: Whop delivers each event at least once.
alter table public.stripe_events rename to billing_events;
alter table public.billing_events rename constraint stripe_events_pkey to billing_events_pkey;
alter table public.billing_events rename column stripe_event_id to event_id;
alter table public.billing_events rename constraint stripe_events_stripe_event_id_key
  to billing_events_event_id_key;
alter table public.billing_events
  add column provider text not null default 'whop',
  add constraint billing_events_provider_values check (provider in ('whop'));

-- 3. Whop plan of each (plan, billing) pair, written by scripts/whop-setup.ts.
create table public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'whop',
  plan text not null,
  billing text not null,
  provider_plan_id text not null unique,
  price_cents integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_plans_unique unique (provider, plan, billing),
  constraint billing_plans_provider_values check (provider in ('whop')),
  constraint billing_plans_plan_values check (plan in ('basic', 'plus', 'premium')),
  constraint billing_plans_billing_values check (billing in ('monthly', 'annual')),
  constraint billing_plans_price_positive check (price_cents > 0)
);

create trigger set_updated_at before update on public.billing_plans
  for each row execute function public.set_updated_at();

alter table public.billing_plans enable row level security;
revoke all on public.billing_plans from anon, authenticated;

-- 4. Accounts with full access without a membership (owner, testers), set by the service role.
alter table public.profiles add column billing_exempt boolean not null default false;
