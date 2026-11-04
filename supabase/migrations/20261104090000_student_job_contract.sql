-- The questionnaire now reads a CV and asks what the student looks for, including a
-- student job (docs/QUESTIONS.md C95). Offers served today are apprenticeships only; the
-- preference is recorded so the other kinds can be served as soon as a source exists.
alter type public.profiles_target_contract add value if not exists 'job_etudiant';
