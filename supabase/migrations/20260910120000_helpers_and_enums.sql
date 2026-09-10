-- Shared helpers and enumerated types.
-- Enum names follow the <table>_<column> convention (see CLAUDE.md).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'Trigger helper: keeps updated_at current on every UPDATE.';

create type public.profiles_diploma_level as enum ('bac', 'bac+2', 'bac+3', 'bac+4', 'bac+5');
create type public.profiles_target_contract as enum ('alternance', 'stage', 'both');
create type public.documents_kind as enum ('cv', 'cover_letter_base');
create type public.offers_source as enum ('api_alternance', 'adzuna', 'france_travail');
create type public.offers_apply_channel as enum ('api_alternance', 'email', 'external_url');
create type public.matches_status as enum ('new', 'saved', 'dismissed', 'applied');
create type public.applications_status as enum (
  'draft', 'ready', 'sent', 'viewed', 'replied_positive', 'replied_negative', 'no_answer', 'unknown'
);
create type public.applications_sent_via as enum ('api_alternance', 'widget', 'partner_site', 'mail_client', 'gmail');
create type public.credit_transactions_reason as enum ('purchase', 'application_sent', 'refund', 'signup_bonus');
create type public.subscriptions_status as enum (
  'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'
);
