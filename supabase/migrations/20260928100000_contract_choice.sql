-- The questionnaire asks the contract with a single click (docs/QUESTIONS.md C92). The
-- column tells an answered question from the default value of target_contract.
alter table public.profiles add column contract_chosen_at timestamptz;
grant update (contract_chosen_at) on public.profiles to authenticated;
