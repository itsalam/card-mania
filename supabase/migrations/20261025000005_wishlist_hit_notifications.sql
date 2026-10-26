-- In-app notifications for new Wishlist Hits (category 'price', type 'wishlist_hit').
--
-- Hits appear through many paths (a listing added to a storefront, a storefront going listed,
-- collection_ids edits, quantity changes, a new wishlist row), so rather than a trigger on each
-- this runs as a scheduled generator over _wishlist_hits(). Dedupe lives in its own table
-- because cleanup-old-notifications prunes the notifications themselves; keying on
-- (user_id, listing_item_id) means one notification per listing even when several of the
-- user's wishlist rows match it ("any grade" + "PSA 10"). A listing that's delisted and relisted
-- as the same row isn't re-announced.

create table if not exists public.wishlist_hit_notifications (
  user_id          uuid not null references auth.users (id) on delete cascade,
  listing_item_id  uuid not null references public.collection_items (id) on delete cascade,
  wishlist_item_id uuid not null references public.collection_items (id) on delete cascade,
  ref_id           uuid not null,
  notification_id  uuid null,
  seeded           boolean not null default false,
  created_at       timestamptz not null default now(),
  primary key (user_id, listing_item_id)
);

alter table public.wishlist_hit_notifications enable row level security;
revoke all on public.wishlist_hit_notifications from anon, authenticated;

-- Returns the number of notifications written. Up to p_max_per_user hits per user per run get
-- their own notification; beyond that the user gets one summary pointing home (where Wishlist
-- Hits lists them all).
create or replace function public.generate_wishlist_hit_notifications(p_max_per_user int default 3)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_individual int := 0;
  v_summaries int := 0;
begin
  drop table if exists _wh_hits;
  drop table if exists _wh_new;

  -- One row per (user, listing); the graded wishlist row wins (its snapshot is the relevant one).
  create temp table _wh_hits on commit drop as
  select distinct on (h.user_id, h.listing_item_id) h.*
    from public._wishlist_hits(null) h
   order by h.user_id, h.listing_item_id, (h.wishlist_grade_condition_id is null), h.wishlisted_at desc;

  create temp table _wh_new on commit drop as select * from _wh_hits where false;

  -- Claim unseen hits in the dedupe table; only those get announced.
  with claimed as (
    insert into public.wishlist_hit_notifications (user_id, listing_item_id, wishlist_item_id, ref_id)
    select user_id, listing_item_id, wishlist_item_id, ref_id from _wh_hits
    on conflict (user_id, listing_item_id) do nothing
    returning user_id, listing_item_id
  )
  insert into _wh_new
  select h.* from _wh_hits h join claimed cl using (user_id, listing_item_id);

  -- Individual notifications for users at or under the cap.
  with ranked as (
    select n.*, count(*) over (partition by n.user_id) as user_total from _wh_new n
  ),
  ins as (
    insert into public.notifications (user_id, type, category, priority, title, body, action_url, payload)
    select r.user_id,
           'wishlist_hit',
           'price',
           'normal',
           'Wishlist hit: ' || coalesce(r.name, 'a card on your wishlist'),
           '@' || coalesce(r.seller_username, r.seller_display_name, 'a seller') || ' listed it'
             -- "psa10" → "PSA 10", "bgs9_5" → "BGS 9.5"
             || case when r.price_key <> 'ungraded'
                     then ' (' || upper(regexp_replace(replace(r.price_key, '_', '.'), '^([a-z]+)', '\1 ')) || ')'
                     else '' end
             || case when r.current_price_cents is not null
                     then ' — now $' || to_char(r.current_price_cents / 100.0, 'FM999999990.00') else '' end
             || case when r.snapshot_price_cents is not null
                          and r.snapshot_price_cents <> coalesce(r.current_price_cents, -1)
                     then ', $' || to_char(r.snapshot_price_cents / 100.0, 'FM999999990.00') || ' when you wishlisted it'
                     else '' end,
           '/profile/' || r.listing_item_id || '?cardId=' || r.ref_id || '&collectionId=' || r.listing_collection_id,
           jsonb_build_object(
             'wishlist_item_id', r.wishlist_item_id,
             'listing_item_id', r.listing_item_id,
             'card_id', r.ref_id,
             'seller_id', r.seller_id,
             'price_key', r.price_key,
             'current_cents', r.current_price_cents,
             'snapshot_cents', r.snapshot_price_cents)
      from ranked r
     where r.user_total <= p_max_per_user
    returning id, user_id, (payload ->> 'listing_item_id')::uuid as listing_item_id
  )
  update public.wishlist_hit_notifications d
     set notification_id = ins.id
    from ins
   where d.user_id = ins.user_id and d.listing_item_id = ins.listing_item_id;
  get diagnostics v_individual = row_count;

  -- One summary per user over the cap, pointing home (Wishlist Hits lists them all).
  with ranked as (
    select n.*,
           count(*) over (partition by n.user_id) as user_total,
           row_number() over (partition by n.user_id
                              order by n.savings_pct desc nulls last, n.listed_at desc nulls last) as rn
      from _wh_new n
  ),
  ins as (
    insert into public.notifications (user_id, type, category, priority, title, body, action_url, payload)
    select r.user_id,
           'wishlist_hit',
           'price',
           'normal',
           r.user_total || ' cards on your wishlist are available',
           'Including ' || coalesce(r.name, 'a card') || ' from @'
             || coalesce(r.seller_username, r.seller_display_name, 'a seller') || '.',
           '/',
           jsonb_build_object('summary', true, 'count', r.user_total)
      from ranked r
     where r.user_total > p_max_per_user and r.rn = 1
    returning id, user_id
  )
  update public.wishlist_hit_notifications d
     set notification_id = ins.id
    from ins
   where d.user_id = ins.user_id
     and d.notification_id is null
     and d.listing_item_id in (select listing_item_id from _wh_new n where n.user_id = ins.user_id);
  select count(distinct user_id) into v_summaries
    from (select user_id from _wh_new group by user_id having count(*) > p_max_per_user) s;

  return v_individual + v_summaries;
end;
$$;

revoke execute on function public.generate_wishlist_hit_notifications(int) from public, anon, authenticated;
grant execute on function public.generate_wishlist_hit_notifications(int) to service_role;

-- Seed every hit that already exists, so the first run doesn't announce long-standing listings.
insert into public.wishlist_hit_notifications (user_id, listing_item_id, wishlist_item_id, ref_id, seeded)
select distinct on (h.user_id, h.listing_item_id)
       h.user_id, h.listing_item_id, h.wishlist_item_id, h.ref_id, true
  from public._wishlist_hits(null) h
 order by h.user_id, h.listing_item_id
on conflict (user_id, listing_item_id) do nothing;

-- Runs entirely in the database (no edge function), like marketplace-sections-refresh.
select cron.schedule(
  'wishlist-hit-notifications',
  '5,20,35,50 * * * *',
  $$ select public.generate_wishlist_hit_notifications() $$
);
