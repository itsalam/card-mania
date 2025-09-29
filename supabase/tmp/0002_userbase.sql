create extension if not exists "uuid-ossp";
create extension if not exists citext;

create table public.profiles (
  user_id uuid primary key
    references auth.users(id) on delete cascade,
  username citext unique,                 -- optional public handle
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on public.profiles (username);
