-- Noise filter of the offers list (docs/QUESTIONS.md C120): offers managed by a school, by
-- a training body or by a staffing agency are hidden by default. The kind is computed when
-- the offer is stored (lib/offers/noise.ts); the student's choice lives on the profile.

alter table public.offers
  add column noise_kind text,
  add constraint offers_noise_kind_values
    check (noise_kind is null or noise_kind in ('school', 'training', 'staffing'));

alter table public.profiles
  add column hide_noise boolean not null default true;

grant update (hide_noise) on public.profiles to authenticated;
