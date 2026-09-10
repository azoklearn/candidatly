-- Private bucket for CVs and cover letters. Each user reads and writes only
-- under the folder named after their user id: <user_id>/<kind>/<file>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  5242880,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy documents_bucket_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy documents_bucket_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy documents_bucket_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy documents_bucket_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
