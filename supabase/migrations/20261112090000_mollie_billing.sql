-- Payments through Mollie next to Whop (docs/QUESTIONS.md C109). The tables already carry
-- a provider column; only its allowed values change. Whop memberships stay as they are.

alter table public.subscriptions
  drop constraint subscriptions_provider_values,
  add constraint subscriptions_provider_values check (provider in ('whop', 'mollie'));

alter table public.billing_events
  drop constraint billing_events_provider_values,
  add constraint billing_events_provider_values check (provider in ('whop', 'mollie'));

alter table public.billing_plans
  drop constraint billing_plans_provider_values,
  add constraint billing_plans_provider_values check (provider in ('whop', 'mollie'));
