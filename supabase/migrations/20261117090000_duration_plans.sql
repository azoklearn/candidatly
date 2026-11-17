-- Plans by duration (docs/QUESTIONS.md C113): 1 mois renews every month, 3 mois every three
-- months, À vie is paid once. "annual" stays allowed for the Whop memberships sold before.

alter table public.subscriptions
  drop constraint subscriptions_billing_values,
  add constraint subscriptions_billing_values
    check (billing is null or billing in ('monthly', 'quarterly', 'lifetime', 'annual'));

alter table public.billing_plans
  drop constraint billing_plans_billing_values,
  add constraint billing_plans_billing_values
    check (billing in ('monthly', 'quarterly', 'lifetime', 'annual'));

alter table public.profiles
  drop constraint profiles_chosen_billing_values,
  add constraint profiles_chosen_billing_values
    check (chosen_billing is null or chosen_billing in ('monthly', 'quarterly', 'lifetime', 'annual'));
