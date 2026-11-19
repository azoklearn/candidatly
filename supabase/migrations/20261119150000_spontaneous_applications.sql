-- Unsolicited applications (docs/QUESTIONS.md C121): an application can target a company
-- of the student's search instead of a published offer. The company is copied onto the
-- application, because the list of companies changes with each search.

alter table public.applications
  alter column offer_id drop not null,
  add column company_key text,
  add column company_name text,
  add column company_siret text,
  add column company_address text,
  add column company_apply_url text,
  add column company_phone text,
  -- The trade the letter names, taken from the student's profile.
  add column target_title text,
  add constraint applications_target check (
    (offer_id is not null and company_key is null)
    or (offer_id is null and company_key is not null and company_name is not null)
  );

create unique index applications_user_company_key
  on public.applications (user_id, company_key)
  where company_key is not null;
