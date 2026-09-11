-- Plan chosen by the student after the questionnaire (docs/QUESTIONS.md C82). No payment
-- yet: the choice is recorded and access stays open until Stripe is connected (A5).
-- Written by the service role only: the columns are not in the client's update grant.

alter table public.profiles
  add column chosen_plan text,
  add column chosen_billing text,
  add column plan_chosen_at timestamptz,
  add constraint profiles_chosen_plan_values
    check (chosen_plan is null or chosen_plan in ('basic', 'plus', 'premium')),
  add constraint profiles_chosen_billing_values
    check (chosen_billing is null or chosen_billing in ('monthly', 'annual')),
  add constraint profiles_plan_choice_complete
    check ((chosen_plan is null) = (chosen_billing is null)
      and (chosen_plan is null) = (plan_chosen_at is null));
