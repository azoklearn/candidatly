-- Students may skip the CV and cover letter step of the questionnaire (docs/QUESTIONS.md C89).
-- The skip is remembered so the step counts as done; the documents can be added later from
-- the account page.

alter table public.profiles add column documents_skipped_at timestamptz;

grant update (documents_skipped_at) on public.profiles to authenticated;
