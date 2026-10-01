create table public.profiles (
  id uuid primary key,
  moodle_user_id bigint unique not null,
  numl_id text not null,
  full_name text not null default '',
  email text,
  role text not null default 'student',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by signed in" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create index profiles_numl_id_idx on public.profiles (lower(numl_id));

create table public.moodle_tokens (
  user_id uuid primary key,
  token text not null,
  private_token text,
  updated_at timestamptz not null default now()
);
grant all on public.moodle_tokens to service_role;
alter table public.moodle_tokens enable row level security;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  folder text not null default 'General',
  storage_path text not null unique,
  size_bytes bigint not null default 0,
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null,
  addressee_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id)
);
grant select, insert, update, delete on public.contacts to authenticated;
grant all on public.contacts to service_role;
alter table public.contacts enable row level security;
create policy "see own contacts" on public.contacts for select to authenticated using (auth.uid() in (requester_id, addressee_id));
create policy "request contact" on public.contacts for insert to authenticated with check (auth.uid() = requester_id and status = 'pending');
create policy "update own contacts" on public.contacts for update to authenticated using (auth.uid() in (requester_id, addressee_id));
create policy "delete own contacts" on public.contacts for delete to authenticated using (auth.uid() in (requester_id, addressee_id));

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null,
  body text not null default '',
  document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at);
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.conversation_members to authenticated;
grant select, insert, delete on public.messages to authenticated;
grant all on public.conversations, public.conversation_members, public.messages to service_role;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_conversation_member(_conv uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = _conv and user_id = _user)
$$;

create or replace function public.can_read_document(_doc uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documents d where d.id = _doc and d.owner_id = _user)
      or exists (select 1 from public.messages m join public.conversation_members cm on cm.conversation_id = m.conversation_id
                 where m.document_id = _doc and cm.user_id = _user)
$$;

create policy "members see conversation" on public.conversations for select to authenticated using (public.is_conversation_member(id, auth.uid()) or created_by = auth.uid());
create policy "create conversation" on public.conversations for insert to authenticated with check (created_by = auth.uid());
create policy "members update conversation" on public.conversations for update to authenticated using (public.is_conversation_member(id, auth.uid()));

create policy "members see members" on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "creator or self adds members" on public.conversation_members for insert to authenticated with check (
  user_id = auth.uid() or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid())
);
create policy "update own membership" on public.conversation_members for update to authenticated using (user_id = auth.uid());
create policy "leave conversation" on public.conversation_members for delete to authenticated using (user_id = auth.uid());

create policy "members read messages" on public.messages for select to authenticated using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "members send messages" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and public.is_conversation_member(conversation_id, auth.uid())
  and (document_id is null or exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid()))
);
create policy "delete own messages" on public.messages for delete to authenticated using (sender_id = auth.uid());

create policy "read own or shared docs" on public.documents for select to authenticated using (public.can_read_document(id, auth.uid()));
create policy "insert own docs" on public.documents for insert to authenticated with check (owner_id = auth.uid());
create policy "update own docs" on public.documents for update to authenticated using (owner_id = auth.uid());
create policy "delete own docs" on public.documents for delete to authenticated using (owner_id = auth.uid());

create or replace function public.enforce_storage_quota()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select coalesce(sum(size_bytes),0) from public.documents) + new.size_bytes > 25::bigint * 1024 * 1024 * 1024 then
    raise exception 'Storage limit of 25 GB reached';
  end if;
  return new;
end $$;
create trigger documents_quota before insert on public.documents for each row execute function public.enforce_storage_quota();

create or replace function public.storage_usage()
returns table (total_bytes bigint, my_bytes bigint, limit_bytes bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(size_bytes),0)::bigint,
         coalesce(sum(size_bytes) filter (where owner_id = auth.uid()),0)::bigint,
         (25::bigint * 1024 * 1024 * 1024)
  from public.documents
$$;
grant execute on function public.storage_usage() to authenticated;

create or replace function public.bump_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end $$;
create trigger messages_bump after insert on public.messages for each row execute function public.bump_conversation();

create table public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  user_id uuid not null,
  message jsonb not null,
  created_at timestamptz not null default now()
);
create index ai_messages_thread_idx on public.ai_messages (thread_id, created_at);
grant select, insert, update, delete on public.ai_threads, public.ai_messages to authenticated;
grant all on public.ai_threads, public.ai_messages to service_role;
alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;
create policy "own threads" on public.ai_threads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own ai messages" on public.ai_messages for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.conversation_members;