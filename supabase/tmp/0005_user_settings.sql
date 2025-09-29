create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_complete boolean default false,
  push_opt_in boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.user_settings enable row level security;
create policy "Owner select" on public.user_settings for select using (auth.uid() = user_id);
create policy "Owner upsert"  on public.user_settings for insert with check (auth.uid() = user_id);
create policy "Owner update"  on public.user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);