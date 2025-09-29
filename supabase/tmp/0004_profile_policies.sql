alter table public.profiles enable row level security;

-- Anyone can read safe public fields (optional)
create policy "Public read profiles"
on public.profiles for select
using (true);

-- Only the owner can insert their own row (if you ever allow client-side inserts)
create policy "Self insert profile"
on public.profiles for insert
with check (auth.uid() = user_id);

-- Only the owner can update their row
create policy "Self update profile"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);