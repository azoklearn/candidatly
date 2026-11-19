-- Longer questionnaire with a personal plan (docs/QUESTIONS.md C118): where the student
-- stands, when they want to start, how much they apply and what blocks them most. Four
-- answers given with one click each; they only shape the plan shown after the search.

alter table public.profiles
  add column situation text,
  add column start_timing text,
  add column weekly_applications text,
  add column main_blocker text,
  add constraint profiles_situation_values
    check (situation is null or situation in ('has_school', 'seeking_school', 'started', 'exploring')),
  -- A month ("2027-09"), as soon as possible, or not known yet.
  add constraint profiles_start_timing_values
    check (
      start_timing is null
      or start_timing in ('asap', 'unknown')
      or start_timing ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    ),
  add constraint profiles_weekly_applications_values
    check (weekly_applications is null or weekly_applications in ('low', 'medium', 'high')),
  add constraint profiles_main_blocker_values
    check (main_blocker is null or main_blocker in ('offers', 'answers', 'time', 'companies'));

grant update (situation, start_timing, weekly_applications, main_blocker)
  on public.profiles to authenticated;
