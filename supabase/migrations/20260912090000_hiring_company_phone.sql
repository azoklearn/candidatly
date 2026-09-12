-- Phone number of the companies likely to hire (docs/QUESTIONS.md C87). The API gives one
-- for about a third of them; it is the only direct channel, no source exposes an email.

alter table public.hiring_companies
  add column phone text,
  add constraint hiring_companies_phone_length check (phone is null or length(phone) <= 40);
