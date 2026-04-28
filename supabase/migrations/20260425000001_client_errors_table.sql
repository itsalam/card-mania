-- Collects client-side mutation/operation errors for observability.
-- In production the client inserts silently; in development errors are thrown locally instead.

create table if not exists public.client_errors (
  id         bigint primary key generated always as identity,
  user_id    uuid references auth.users(id) on delete set null,
  context    text        not null,
  message    text        not null,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

alter table public.client_errors enable row level security;

create policy "client_errors: insert own"
  on public.client_errors
  for insert
  to authenticated
  with check (user_id = auth.uid());
