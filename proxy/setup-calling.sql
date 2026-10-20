-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
create table if not exists public.call_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

alter table public.call_profiles enable row level security;

-- Anyone can look up a username (needed to call someone and to check a name is free).
drop policy if exists "call_profiles read" on public.call_profiles;
create policy "call_profiles read" on public.call_profiles
  for select to anon, authenticated using (true);

-- You can only create your own profile.
drop policy if exists "call_profiles insert own" on public.call_profiles;
create policy "call_profiles insert own" on public.call_profiles
  for insert to authenticated with check (auth.uid() = id);

-- Messages (direct messages + in-call chat)
create table if not exists public.call_messages (
  id bigint generated always as identity primary key,
  sender uuid not null references auth.users(id) on delete cascade,
  recipient uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists call_messages_pair_idx on public.call_messages (sender, recipient, created_at desc);

alter table public.call_messages enable row level security;

-- You can only read messages you sent or received.
drop policy if exists "call_messages read own" on public.call_messages;
create policy "call_messages read own" on public.call_messages
  for select to authenticated using (auth.uid() = sender or auth.uid() = recipient);

-- You can only send messages as yourself.
drop policy if exists "call_messages send own" on public.call_messages;
create policy "call_messages send own" on public.call_messages
  for insert to authenticated with check (auth.uid() = sender);
