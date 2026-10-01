create or replace function public.enforce_storage_quota()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select coalesce(sum(size_bytes),0) from public.documents where owner_id = new.owner_id) + new.size_bytes > 25::bigint * 1024 * 1024 * 1024 then
    raise exception 'Storage limit reached';
  end if;
  return new;
end $$;
revoke execute on function public.enforce_storage_quota() from public, anon, authenticated;