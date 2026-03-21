-- User profile + storefront scaffolding
-- Ties profiles/storefronts back to Supabase auth.users for RLS alignment.

create table if not exists public.user_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  location text,
  timezone text,
  is_seller boolean not null default false,
  is_hobbyiest boolean not null default false,
  preferences jsonb not null default '{}' :: jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profile_username_idx on public.user_profile (lower(username));

create table if not exists public.storefronts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  description text,
  is_listed boolean not null default false,
  collection_ids uuid[] not null default '{}' :: uuid[],
  tags text[] not null default '{}' :: text[],
  whitelist_user_ids uuid[] not null default '{}' :: uuid[], -- whitelisters
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  listed_at timestamptz
);

create index if not exists storefronts_user_idx on public.storefronts (user_id);
create index if not exists storefronts_listed_idx on public.storefronts (is_listed);
create index if not exists storefronts_collection_ids_idx on public.storefronts using gin (collection_ids);
create index if not exists storefronts_tags_idx on public.storefronts using gin (tags);
create index if not exists storefronts_whitelist_idx on public.storefronts using gin (whitelist_user_ids);
