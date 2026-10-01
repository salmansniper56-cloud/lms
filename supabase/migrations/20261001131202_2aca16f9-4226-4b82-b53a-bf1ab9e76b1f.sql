revoke execute on function public.is_conversation_member(uuid, uuid) from public, anon;
revoke execute on function public.can_read_document(uuid, uuid) from public, anon;
revoke execute on function public.storage_usage() from public, anon;
revoke execute on function public.enforce_storage_quota() from public, anon, authenticated;
revoke execute on function public.bump_conversation() from public, anon, authenticated;

create policy "upload own files" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own or shared files" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.documents d where d.storage_path = name and public.can_read_document(d.id, auth.uid()))
  ));