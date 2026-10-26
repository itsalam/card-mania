-- Wishlist price snapshot: what a card cost when it was wishlisted, so Wishlist Hits and
-- hit notifications can show "now $X — $Y when you wishlisted it".
--
-- The whole grades_prices object is captured (not one number): a wishlist row with no grade
-- (= any grade) can then be compared against whichever grade a matching listing has, via
-- price_snapshot ->> listing.price_key.

alter table public.collection_items
  add column if not exists price_snapshot jsonb null,
  add column if not exists price_snapshot_at timestamptz null;

-- BEFORE INSERT on collection_items rather than inside wishlist_toggle, so every insert path
-- into a wishlist collection is covered. useToggleWishlist calls ensure_card_stub before
-- wishlist_toggle, so the cards row (and its prices) already exists here.
create or replace function public._ci_wishlist_price_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.item_kind = 'card'::public.item_kind
     and new.price_snapshot is null
     and exists (select 1 from public.collections c where c.id = new.collection_id and c.is_wishlist)
  then
    select c.grades_prices, now() into new.price_snapshot, new.price_snapshot_at
      from public.cards c where c.id = new.ref_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ci_wishlist_price_snapshot on public.collection_items;
create trigger trg_ci_wishlist_price_snapshot
  before insert on public.collection_items
  for each row execute function public._ci_wishlist_price_snapshot();

-- Backfill existing wishlist rows: per grade, the latest recorded price at or before the row's
-- created_at, merged over current prices. History usually starts after the add, so most rows
-- fall back to today's prices and show no savings until prices move — honest, not invented.
update public.collection_items ci
   set price_snapshot =
         coalesce((select c.grades_prices from public.cards c where c.id = ci.ref_id), '{}'::jsonb)
         || coalesce((select jsonb_object_agg(h.grade, h.price_cents)
                        from (select distinct on (grade) grade, price_cents
                                from public.card_price_history
                               where card_id = ci.ref_id and recorded_at <= ci.created_at
                               order by grade, recorded_at desc) h), '{}'::jsonb),
       price_snapshot_at = ci.created_at
 where ci.item_kind = 'card'::public.item_kind
   and ci.price_snapshot is null
   and exists (select 1 from public.collections col where col.id = ci.collection_id and col.is_wishlist)
   and exists (select 1 from public.cards c where c.id = ci.ref_id);

-- ensure_card_stub takes client-supplied prices and is callable by any signed-in user, so it
-- could overwrite any card's prices. Once the server has refreshed a card
-- (prices_refreshed_at set by apply_card_price_refresh), client prices are ignored on conflict;
-- they're still accepted for brand-new cards and never-refreshed ones (as before).
create or replace function public.ensure_card_stub(
  p_id uuid,
  p_name text,
  p_set_name text default ''::text,
  p_genre text default 'trading_card'::text,
  p_grades_prices jsonb default '{}'::jsonb,
  p_latest_price numeric default null::numeric,
  p_image_url text default null::text,
  p_provider text default null::text,
  p_external_id text default null::text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_image_id uuid;
begin
  insert into public.cards (id, name, set_name, genre, grades_prices, latest_price)
  values (
    p_id,
    p_name,
    coalesce(p_set_name, ''),
    coalesce(p_genre, 'trading_card'),
    coalesce(p_grades_prices, '{}'),
    p_latest_price
  )
  on conflict (id) do update set
    -- Only overwrite grades_prices when the caller actually supplies prices (an empty object
    -- means "no data") and the server hasn't refreshed this card itself.
    grades_prices = case
      when excluded.grades_prices = '{}'::jsonb or cards.prices_refreshed_at is not null
        then cards.grades_prices
      else excluded.grades_prices
    end,
    -- Preserve an existing latest_price when the caller passes null or the server owns it.
    latest_price  = case
      when cards.prices_refreshed_at is not null then cards.latest_price
      else coalesce(excluded.latest_price, cards.latest_price)
    end,
    last_updated  = now();

  if p_image_url is not null then
    if not exists (
      select 1 from public.card_images where card_id = p_id and is_primary
    ) then
      insert into public.card_images (card_id, source_url, status, kind, is_primary)
      values (p_id, p_image_url, 'READY', 'front', true)
      returning id into v_image_id;
    end if;

    update public.cards
      set front_image_id = coalesce(
        v_image_id,
        (select id from public.card_images where card_id = p_id and is_primary limit 1)
      )
    where id = p_id and front_image_id is null;
  end if;

  if p_provider is not null and p_external_id is not null then
    insert into public.external_refs (provider, external_id, card_id, suggested_uuid)
    values (p_provider, p_external_id, p_id, p_id)
    on conflict (provider, external_id) do nothing;
  end if;
end;
$function$;
