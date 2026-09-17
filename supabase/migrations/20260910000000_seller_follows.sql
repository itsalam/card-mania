-- Suggested Sellers "Follow" button (ITS-107 follow-up) — a minimal, real toggle mirroring
-- the wishlist_toggle RPC pattern (client/card/wishlist.ts's useToggleWishlist): optimistic
-- client flip + a security-definer RPC that does the actual insert/delete, so the button is
-- real state, not a client-only mock like AvailableNow's placeholder items.

create table if not exists public.seller_follows (
  follower_id uuid        not null references auth.users(id) on delete cascade,
  seller_id   uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, seller_id),
  constraint seller_follows_no_self_follow check (follower_id <> seller_id)
);

create index if not exists idx_seller_follows_seller on public.seller_follows (seller_id);

alter table public.seller_follows enable row level security;

create policy "seller_follows_owner_all" on public.seller_follows
  for all
  using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id);

-- Toggles the caller's follow of p_seller_id, returns the resulting state.
create or replace function public.toggle_seller_follow(p_seller_id uuid)
returns table (is_following boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follower_id uuid := auth.uid();
  v_existed boolean;
begin
  if v_follower_id is null then
    raise exception 'Not authenticated';
  end if;
  if v_follower_id = p_seller_id then
    raise exception 'Cannot follow yourself';
  end if;

  select exists (
    select 1 from public.seller_follows
    where follower_id = v_follower_id and seller_id = p_seller_id
  ) into v_existed;

  if v_existed then
    delete from public.seller_follows
    where follower_id = v_follower_id and seller_id = p_seller_id;
  else
    insert into public.seller_follows (follower_id, seller_id)
    values (v_follower_id, p_seller_id);
  end if;

  return query select not v_existed;
end;
$$;

grant execute on function public.toggle_seller_follow(uuid) to authenticated;

-- All seller_ids the caller currently follows — small, per-user set, fetched whole rather
-- than parameterized by a candidate list, so the client can toggle from cache without refetching.
create or replace function public.get_followed_sellers()
returns table (seller_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select seller_id from public.seller_follows where follower_id = auth.uid();
$$;

grant execute on function public.get_followed_sellers() to authenticated;
