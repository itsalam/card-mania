-- ITS-135: the server moves a sold card from the seller to the buyer (Flow D).
--
-- Decisions (Nov 26, 2026; docs/collections/ownership-transfer.md):
--   * Accepting an offer *holds* the listed copies: they stay in the seller's collections but
--     can't be bought (collection_items.held_quantity). Nothing leaves at acceptance any more.
--   * When the buyer confirms receipt, the same transaction marks the copies sold on the
--     seller's side and adds them to the buyer's Vault: one new row per offer item, keeping
--     grade, grading company, variants and photos, linked back via source_offer_item_id.
--   * Photos are shared: the buyer's rows point at the seller's stored files. A file is only
--     removed once no photo row uses it (delete_collection_item_photo).
--   * Disputed transactions keep the hold and transfer nothing; resolving them is follow-up
--     admin work.
--   * Idempotent: transactions.transferred_at plus a unique source_offer_item_id.
--
-- Replaces the client-side "Reflect changes in my collection" step (useAddOfferItemsToCollection)
-- and the transactions_after_insert trigger that removed stock at acceptance.
--
-- Listings are rows in storefront collections, mirrored into the seller's Selling collection
-- (collection_ref = the storefront collection) and from there into the Vault. The hold lives
-- on the listing row; `quantity` keeps meaning "copies owned", and what can still be bought
-- is quantity - held_quantity.

-- ── columns ─────────────────────────────────────────────────────────────────

alter table public.collection_items
  add column if not exists held_quantity integer not null default 0,
  add column if not exists source_offer_item_id uuid references public.offer_items (id) on delete set null;

alter table public.collection_items
  drop constraint if exists collection_items_held_within_quantity;
alter table public.collection_items
  add constraint collection_items_held_within_quantity
  check (held_quantity >= 0 and held_quantity <= quantity);

-- One buyer row per sold offer item, however often the transfer runs.
create unique index if not exists collection_items_source_offer_item_key
  on public.collection_items (source_offer_item_id);

comment on column public.collection_items.held_quantity is
  'Copies of this listing promised to an accepted offer that hasn''t completed (ITS-135). Available = quantity - held_quantity.';
comment on column public.collection_items.source_offer_item_id is
  'Set on the buyer''s Vault row created by a completed sale (ITS-135).';

-- Transactions created before this migration already removed the seller's stock at
-- acceptance, so completing them only adds the buyer's copy.
alter table public.transactions
  add column if not exists holds_stock boolean not null default false,
  add column if not exists transferred_at timestamptz;
alter table public.transactions alter column holds_stock set default true;

comment on column public.transactions.holds_stock is
  'True when acceptance put the listed copies on hold (ITS-135). False for older transactions, whose stock was removed at acceptance.';
comment on column public.transactions.transferred_at is
  'When the sold copies moved to the buyer''s Vault (ITS-135). Set once.';

-- Stock no longer moves when the transaction is created.
drop trigger if exists transactions_after_insert on public.transactions;
drop function if exists public.decrement_inventory_on_transaction();

-- ── guard held copies ───────────────────────────────────────────────────────

-- A seller can't delete, shrink below the hold, or change what a held listing is while a
-- sale is in progress. The transfer itself releases the hold before it touches quantity.
create or replace function public._guard_held_collection_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.held_quantity > 0 then
      raise exception 'This card is on hold for a sale in progress' using errcode = '23514';
    end if;
    return old;
  end if;

  if new.held_quantity > 0 then
    if new.quantity < new.held_quantity then
      raise exception '% of these are on hold for a sale in progress', new.held_quantity
        using errcode = '23514';
    end if;
    if new.ref_id is distinct from old.ref_id
       or new.item_kind is distinct from old.item_kind
       or new.collection_id is distinct from old.collection_id
       or new.grade_condition_id is distinct from old.grade_condition_id
       or new.grading_company is distinct from old.grading_company
       or coalesce(new.variants, '{}') is distinct from coalesce(old.variants, '{}') then
      raise exception 'This card is on hold for a sale in progress and can''t be changed'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists collection_items_guard_held on public.collection_items;
create trigger collection_items_guard_held
  before update or delete on public.collection_items
  for each row
  when (old.held_quantity > 0)
  execute function public._guard_held_collection_item();

-- ── offers: availability excludes held copies ───────────────────────────────

create or replace function public.create_offer(
  p_seller_id uuid,
  p_items jsonb,
  p_buyer_note text default null,
  p_total_amount numeric default null
)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_total numeric(10,2);
  v_bad record;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_seller_id is null or p_seller_id = v_uid then
    raise exception 'You cannot make an offer on your own items' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An offer needs at least one item' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(collection_item_id uuid, quantity int, offered_price_per_unit numeric, card_snapshot jsonb)
     where collection_item_id is null
        or quantity is null or quantity <= 0
        or offered_price_per_unit is null or offered_price_per_unit < 0
  ) then
    raise exception 'Each item needs a listing, a positive quantity and a price' using errcode = '22023';
  end if;

  -- Every item must be the seller's and available (summing duplicates of one listing).
  -- Copies on hold for an accepted offer don't count (ITS-135).
  select r.collection_item_id, r.requested, ci.quantity - ci.held_quantity as available, ci.user_id
    into v_bad
    from (select collection_item_id, sum(quantity) as requested
            from jsonb_to_recordset(p_items) as i(collection_item_id uuid, quantity int, offered_price_per_unit numeric, card_snapshot jsonb)
           group by collection_item_id) r
    left join public.collection_items ci on ci.id = r.collection_item_id
   where ci.id is null or ci.user_id <> p_seller_id or ci.quantity - ci.held_quantity < r.requested
   limit 1;
  if found then
    if v_bad.user_id is null or v_bad.user_id <> p_seller_id then
      raise exception 'An item in this offer is no longer listed by this seller' using errcode = 'P0002';
    end if;
    raise exception 'Only % of an item in this offer are available', v_bad.available using errcode = '22023';
  end if;

  -- Buyers can only offer on listed items (same rule as _marketplace_base_listings: a listed
  -- storefront whose collection_ids include a storefront collection holding the item).
  -- Unlisted items stay the seller's to offer; accept_offer doesn't re-check listing, so a
  -- seller can still accept an offer on an item they've since delisted.
  if exists (
    select 1
      from jsonb_to_recordset(p_items) as i(collection_item_id uuid, quantity int, offered_price_per_unit numeric, card_snapshot jsonb)
     where not exists (
       select 1
         from public.collection_items ci
         join public.collections col on col.id = ci.collection_id and coalesce(col.is_storefront, false)
         join public.storefronts sf on sf.user_id = ci.user_id and sf.is_listed and col.id = any (sf.collection_ids)
        where ci.id = i.collection_item_id
     )
  ) then
    raise exception 'An item in this offer is not listed for sale' using errcode = '22023';
  end if;

  v_total := coalesce(
    p_total_amount,
    (select sum(quantity * offered_price_per_unit) from jsonb_to_recordset(p_items) as i(collection_item_id uuid, quantity int, offered_price_per_unit numeric, card_snapshot jsonb))
  );
  if v_total < 0 then
    raise exception 'Offer total cannot be negative' using errcode = '22023';
  end if;

  insert into public.offers (buyer_id, seller_id, buyer_note, total_amount)
  values (v_uid, p_seller_id, nullif(btrim(p_buyer_note), ''), v_total)
  returning * into v_offer;

  insert into public.offer_items (offer_id, collection_item_id, quantity, offered_price_per_unit, card_snapshot)
  select v_offer.id, i.collection_item_id, i.quantity, i.offered_price_per_unit, nullif(i.card_snapshot, 'null'::jsonb)
    from jsonb_to_recordset(p_items) as i(collection_item_id uuid, quantity int, offered_price_per_unit numeric, card_snapshot jsonb);

  return v_offer;
end;
$$;

-- Accepting holds the copies instead of removing them (replacing 20261124000000).
create or replace function public.accept_offer(p_offer_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_tx public.transactions;
  v_item_ids uuid[];
  v_short record;
begin
  v_offer := public._lock_offer_for_transition(p_offer_id, 'either', array['pending', 'countered'], 'accept');
  perform public._assert_offer_turn(v_offer, 'accept');

  select array_agg(distinct collection_item_id order by collection_item_id)
    into v_item_ids
    from public.offer_items
   where offer_id = p_offer_id;

  -- Lock the listings in a stable order so two accepts on overlapping items serialize
  -- instead of deadlocking.
  perform 1 from public.collection_items
   where id = any (v_item_ids)
   order by id
   for update;

  select r.requested, ci.quantity - ci.held_quantity as available
    into v_short
    from (select collection_item_id, sum(quantity) as requested
            from public.offer_items where offer_id = p_offer_id
           group by collection_item_id) r
    left join public.collection_items ci on ci.id = r.collection_item_id
   where r.collection_item_id is null or ci.id is null or ci.quantity - ci.held_quantity < r.requested
   limit 1;
  if found then
    raise exception 'Not enough stock to accept this offer (% left, % requested)',
      coalesce(v_short.available, 0), v_short.requested
      using errcode = '22023';
  end if;

  update public.offers set status = 'accepted' where id = p_offer_id;

  insert into public.transactions (offer_id, holds_stock) values (p_offer_id, true)
  returning * into v_tx;

  -- Hold the copies: still the seller's, no longer for sale.
  update public.collection_items ci
     set held_quantity = ci.held_quantity + r.requested
    from (select collection_item_id, sum(quantity) as requested
            from public.offer_items where offer_id = p_offer_id
           group by collection_item_id) r
   where ci.id = r.collection_item_id;

  -- Decline open competing offers (including ones mid-negotiation) that the remaining
  -- available stock can no longer fill.
  update public.offers o
     set status = 'declined'
   where o.status in ('pending', 'countered')
     and o.id <> p_offer_id
     and exists (
       select 1
         from (select collection_item_id, sum(quantity) as requested
                 from public.offer_items where offer_id = o.id
                group by collection_item_id) r
         left join public.collection_items ci on ci.id = r.collection_item_id
        where r.collection_item_id = any (v_item_ids)
          and (ci.id is null or ci.quantity - ci.held_quantity < r.requested)
     );

  return v_tx;
end;
$$;

-- ── transfer ────────────────────────────────────────────────────────────────

-- Moves a completed transaction's copies to the buyer. Runs inside confirm_transaction_receipt;
-- safe to call again (no-op once transferred_at is set, and buyer rows are unique per offer
-- item).
create or replace function public._transfer_transaction_items(p_tx_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_offer public.offers;
  v_buyer_vault uuid;
  v_seller_selling uuid;
  v_item public.offer_items;
  v_listing public.collection_items;
  v_selling_row uuid;
  v_vault_row uuid;
  v_photo_source uuid;
  v_ref uuid;
  v_new_id uuid;
  v_left integer;
begin
  select * into v_tx from public.transactions where id = p_tx_id for update;
  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if v_tx.transferred_at is not null then
    return;
  end if;
  if v_tx.status <> 'completed' then
    raise exception 'Only a completed sale moves to the buyer (this one is %)', v_tx.status
      using errcode = '22023';
  end if;

  select * into v_offer from public.offers where id = v_tx.offer_id;

  perform public.ensure_default_collections_for_user(v_offer.buyer_id);
  select id into v_buyer_vault
    from public.collections
   where user_id = v_offer.buyer_id and coalesce(is_vault, false)
   order by created_at
   limit 1;

  select id into v_seller_selling
    from public.collections
   where user_id = v_offer.seller_id and coalesce(is_selling, false)
   order by created_at
   limit 1;

  for v_item in
    select * from public.offer_items where offer_id = v_offer.id order by id
  loop
    v_listing := null;
    v_selling_row := null;
    v_vault_row := null;
    v_new_id := null;

    if v_item.collection_item_id is not null then
      select * into v_listing from public.collection_items where id = v_item.collection_item_id for update;
    end if;

    -- The listing's mirrors: Selling (collection_ref = the listing's collection) and the
    -- Vault (collection_ref = Selling), matched on what the copy is.
    if v_listing.id is not null and v_seller_selling is not null then
      select ci.id into v_selling_row
        from public.collection_items ci
       where ci.collection_id = v_seller_selling
         and ci.collection_ref = v_listing.collection_id
         and ci.item_kind = v_listing.item_kind
         and ci.ref_id = v_listing.ref_id
         and ci.grade_condition_id is not distinct from v_listing.grade_condition_id
         and ci.grading_company is not distinct from v_listing.grading_company
         and coalesce(ci.variants, '{}') = coalesce(v_listing.variants, '{}')
       limit 1;

      select ci.id into v_vault_row
        from public.collection_items ci
        join public.collections c on c.id = ci.collection_id and coalesce(c.is_vault, false)
       where ci.user_id = v_offer.seller_id
         and ci.collection_ref = v_seller_selling
         and ci.item_kind = v_listing.item_kind
         and ci.ref_id = v_listing.ref_id
         and ci.grade_condition_id is not distinct from v_listing.grade_condition_id
         and ci.grading_company is not distinct from v_listing.grading_company
         and coalesce(ci.variants, '{}') = coalesce(v_listing.variants, '{}')
       limit 1;
    end if;

    -- What the buyer gets: the listing as it is, or (for an older offer whose listing is
    -- gone) the card from the offer's snapshot.
    v_ref := coalesce(v_listing.ref_id, nullif(v_item.card_snapshot ->> 'card_id', '')::uuid);

    if v_ref is not null and v_buyer_vault is not null then
      insert into public.collection_items (
        collection_id, user_id, item_kind, ref_id, quantity,
        grade_condition_id, grading_company, variants, source_offer_item_id
      )
      values (
        v_buyer_vault, v_offer.buyer_id, coalesce(v_listing.item_kind, 'card'::public.item_kind), v_ref, v_item.quantity,
        v_listing.grade_condition_id, v_listing.grading_company, coalesce(v_listing.variants, '{}'), v_item.id
      )
      on conflict (source_offer_item_id) do nothing
      returning id into v_new_id;

      -- Photos come from whichever of the seller's rows has them (listing first). The files
      -- are shared, not copied.
      if v_new_id is not null and v_listing.id is not null then
        select src.id into v_photo_source
          from (values (v_listing.id, 1), (v_selling_row, 2), (v_vault_row, 3)) as src(id, ord)
         where src.id is not null
           and exists (select 1 from public.collection_item_images img where img.collection_item_id = src.id)
         order by src.ord
         limit 1;

        if v_photo_source is not null then
          insert into public.collection_item_images (
            collection_item_id, user_id, image_cache_id, storage_path, width, height, position, is_primary
          )
          select v_new_id, v_offer.buyer_id, img.image_cache_id, img.storage_path, img.width, img.height,
                 img.position, img.is_primary
            from public.collection_item_images img
           where img.collection_item_id = v_photo_source;
        end if;
      end if;
    end if;

    -- Seller side: release the hold and mark the copies sold. Older transactions already
    -- removed their stock at acceptance.
    if v_tx.holds_stock and v_listing.id is not null then
      update public.collection_items
         set held_quantity = greatest(0, held_quantity - v_item.quantity)
       where id = v_listing.id;

      v_left := greatest(0, v_listing.quantity - v_item.quantity);

      -- Updating the Selling mirror carries the new count to the listing and the Vault
      -- (sync_selling_item_update_to_source / _to_vault). Set the listing directly too, in
      -- case there is no mirror.
      if v_selling_row is not null then
        update public.collection_items set quantity = v_left where id = v_selling_row;
      end if;
      update public.collection_items set quantity = v_left where id = v_listing.id and quantity <> v_left;

      if v_left = 0 then
        -- Removing the listing removes its Selling and Vault mirrors (storefront → selling →
        -- vault delete triggers); the explicit deletes cover mirrors that didn't match.
        delete from public.collection_items where id = v_listing.id;
        delete from public.collection_items where id = v_selling_row;
        delete from public.collection_items where id = v_vault_row and quantity = 0;
      end if;
    end if;
  end loop;

  update public.transactions set transferred_at = now() where id = v_tx.id;
end;
$$;

revoke all on function public._transfer_transaction_items(uuid) from public, anon, authenticated;

-- Confirming receipt completes the sale and moves the copies (replacing 20261123000000).
create or replace function public.confirm_transaction_receipt(p_offer_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  perform public._lock_transaction_for_transition(p_offer_id, 'buyer', array['shipped'], 'confirm receipt of');
  update public.transactions set status = 'completed' where offer_id = p_offer_id returning * into v_tx;
  update public.offers set status = 'completed' where id = p_offer_id;
  perform public._transfer_transaction_items(v_tx.id);
  select * into v_tx from public.transactions where id = v_tx.id;
  return v_tx;
end;
$$;

-- ── shared photos ───────────────────────────────────────────────────────────

-- Deletes one of the caller's photos. Returns the storage path to remove when no other photo
-- row (e.g. a buyer's copy of a sold card) still uses the file, otherwise null.
create or replace function public.delete_collection_item_photo(p_photo_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  delete from public.collection_item_images
   where id = p_photo_id and user_id = auth.uid()
  returning storage_path into v_path;
  if v_path is null then
    raise exception 'Photo not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.collection_item_images where storage_path = v_path) then
    return null;
  end if;
  return v_path;
end;
$$;

revoke all on function public.delete_collection_item_photo(uuid) from public, anon;
grant execute on function public.delete_collection_item_photo(uuid) to authenticated;

-- ── listings: only available copies are for sale ────────────────────────────
-- The functions below are unchanged apart from subtracting held_quantity.

CREATE OR REPLACE FUNCTION public._marketplace_base_listings()
 RETURNS TABLE(collection_item_id uuid, collection_id uuid, storefront_id uuid, seller_id uuid, seller_username text, seller_display_name text, seller_avatar_url text, item_kind item_kind, ref_id uuid, grade_condition_id uuid, grading_company text, quantity integer, variants text[], listed_at timestamp with time zone, name text, set_name text, latest_price numeric, grades_prices jsonb, genre text, front_id text, back_id text, price_key text, market_value integer, popularity_score numeric, sealed boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with
  cfg as (
    select pop_wishlist_weight, pop_sale_weight, pop_log_divisor
    from public.search_config where id = 1
  ),
  wishlist_counts as (
    select ci.ref_id as card_id, count(*) as cnt
    from public.collection_items ci
    join public.collections col on col.id = ci.collection_id
    where ci.item_kind = 'card'
      and col.is_wishlist = true
    group by ci.ref_id
  ),
  sale_counts as (
    select ci.ref_id as card_id, count(*) as cnt
    from public.transactions t
    join public.offers o       on o.id  = t.offer_id
    join public.offer_items oi on oi.offer_id = o.id
    join public.collection_items ci on ci.id = oi.collection_item_id
    where t.status = 'completed'
    group by ci.ref_id
  )
  select
    ci.id                                                                  as collection_item_id,
    ci.collection_id,
    sf.id                                                                  as storefront_id,
    up.user_id                                                             as seller_id,
    up.username                                                            as seller_username,
    up.display_name                                                        as seller_display_name,
    up.avatar_url                                                          as seller_avatar_url,
    ci.item_kind,
    ci.ref_id,
    ci.grade_condition_id,
    ci.grading_company,
    (ci.quantity - ci.held_quantity)::integer as quantity,
    ci.variants,
    sf.listed_at,
    c.name,
    c.set_name,
    c.latest_price,
    c.grades_prices,
    c.genre,
    c.front_id,
    c.back_id,
    coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded')               as price_key,
    coalesce(
      (c.grades_prices ->> coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded'))::int,
      0
    )                                                                      as market_value,
    least(1.0,
      (  (select pop_wishlist_weight from cfg) * log(1.0 + coalesce(wl.cnt, 0)::numeric)
       + (select pop_sale_weight     from cfg) * log(1.0 + coalesce(sl.cnt, 0)::numeric)
      ) / (select pop_log_divisor from cfg)
    )                                                                      as popularity_score,
    coalesce(c.sealed, false)                                             as sealed
  from public.storefronts sf
  join public.user_profile up
    on up.user_id = sf.user_id
  join public.collections col
    on col.id = any(sf.collection_ids)
   and coalesce(col.is_storefront, false) = true
  join public.collection_items ci
    on ci.collection_id = col.id
   and ci.quantity > ci.held_quantity
  left join public.cards c
    on ci.item_kind = 'card'::public.item_kind
   and c.id = ci.ref_id
  left join public.grade_conditions gcnd
    on gcnd.id = ci.grade_condition_id
  left join public.grading_companies gc
    on gc.id = gcnd.company_id
  left join wishlist_counts wl on wl.card_id = c.id
  left join sale_counts     sl on sl.card_id = c.id
  where sf.is_listed = true;
$function$;

CREATE OR REPLACE FUNCTION public._wishlist_hits(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(user_id uuid, wishlist_item_id uuid, wishlisted_at timestamp with time zone, wishlist_grade_condition_id uuid, listing_item_id uuid, listing_collection_id uuid, storefront_id uuid, listed_at timestamp with time zone, ref_id uuid, name text, set_name text, grading_company text, price_key text, seller_id uuid, seller_username text, seller_display_name text, seller_avatar_url text, current_price_cents integer, snapshot_price_cents integer, snapshot_at timestamp with time zone, savings_pct numeric, prices_refreshed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with wishlist as (
    select w.id, w.user_id, w.ref_id, w.grade_condition_id, w.created_at,
           w.price_snapshot, w.price_snapshot_at
      from public.collection_items w
      join public.collections wc on wc.id = w.collection_id and wc.is_wishlist
     where w.item_kind = 'card'::public.item_kind
       and (p_user_id is null or w.user_id = p_user_id)
  ),
  listings as (
    select l.id, l.collection_id, l.user_id, l.ref_id, l.grade_condition_id, l.grading_company,
           sf.id as storefront_id, sf.listed_at,
           public.grade_condition_price_key(l.grade_condition_id) as price_key
      from public.storefronts sf
      join public.collections col
        on col.id = any(sf.collection_ids) and coalesce(col.is_storefront, false)
      join public.collection_items l
        on l.collection_id = col.id and l.quantity > l.held_quantity
       and l.item_kind = 'card'::public.item_kind
     where sf.is_listed
       and l.ref_id in (select ref_id from wishlist)
  )
  select
    w.user_id,
    w.id,
    w.created_at,
    w.grade_condition_id,
    l.id,
    l.collection_id,
    l.storefront_id,
    l.listed_at,
    c.id,
    c.name,
    c.set_name,
    l.grading_company,
    l.price_key,
    up.user_id,
    up.username,
    up.display_name,
    up.avatar_url,
    cur.cents,
    snap.cents,
    w.price_snapshot_at,
    case when snap.cents > 0 and cur.cents > 0
         then round((snap.cents - cur.cents)::numeric / snap.cents * 100, 1) end,
    c.prices_refreshed_at
  from wishlist w
  join listings l
    on l.ref_id = w.ref_id
   and l.user_id <> w.user_id
   and (w.grade_condition_id is null or l.grade_condition_id = w.grade_condition_id)
  join public.cards c on c.id = w.ref_id
  join public.user_profile up on up.user_id = l.user_id
  cross join lateral (select nullif(round((c.grades_prices ->> l.price_key)::numeric), 0)::int as cents) cur
  cross join lateral (select nullif(round((w.price_snapshot ->> l.price_key)::numeric), 0)::int as cents) snap
$function$;

CREATE OR REPLACE FUNCTION public.get_public_storefronts(result_limit integer DEFAULT 20, page_param timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(storefront_id uuid, seller_id uuid, seller_username text, seller_display_name text, seller_avatar_url text, seller_is_seller boolean, title text, description text, tags text[], listed_at timestamp with time zone, item_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    sf.id                as storefront_id,
    up.user_id           as seller_id,
    up.username          as seller_username,
    up.display_name      as seller_display_name,
    up.avatar_url        as seller_avatar_url,
    up.is_seller         as seller_is_seller,
    sf.title,
    sf.description,
    sf.tags,
    sf.listed_at,
    count(ci.id)         as item_count
  from public.storefronts sf
  join public.user_profile up
    on up.user_id = sf.user_id
  join public.collections col
    on col.id = any(sf.collection_ids)
   and coalesce(col.is_storefront, false) = true
  join public.collection_items ci
    on ci.collection_id = col.id
   and ci.quantity > ci.held_quantity
  where sf.is_listed = true
    and (page_param is null or sf.listed_at < page_param)
  group by sf.id, up.user_id, up.username, up.display_name, up.avatar_url, up.is_seller
  order by sf.listed_at desc nulls last
  limit coalesce(result_limit, 20);
$function$;

CREATE OR REPLACE FUNCTION public.get_suggested_sellers(exclude_user_id uuid DEFAULT NULL::uuid, result_limit integer DEFAULT 10)
 RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, is_seller boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (up.user_id)
    up.user_id,
    up.username,
    up.display_name,
    up.avatar_url,
    up.is_seller
  FROM public.user_profile up
  JOIN public.collections c
    ON c.user_id = up.user_id
   AND c.is_storefront = true
  JOIN public.collection_items ci
    ON ci.collection_id = c.id
   AND ci.quantity > ci.held_quantity
  WHERE up.is_seller = true
    AND (exclude_user_id IS NULL OR up.user_id != exclude_user_id)
  ORDER BY up.user_id
  LIMIT result_limit;
$function$;

CREATE OR REPLACE FUNCTION public.search_storefront_items(p_q text DEFAULT ''::text, p_limit integer DEFAULT 20, p_genre text DEFAULT NULL::text, p_sets text[] DEFAULT NULL::text[], p_grading text[] DEFAULT NULL::text[], p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_sealed boolean DEFAULT NULL::boolean)
 RETURNS TABLE(id uuid, card_id uuid, name text, set_name text, price numeric, genre text, sealed boolean, seller_id uuid, seller_username text, grade_label text, grading_company text, score numeric, snippet text, reason jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH q AS (
  SELECT trim(regexp_replace(lower(coalesce(p_q,'')), '\s+', ' ', 'g')) AS qnorm
)
SELECT
  ci.id,
  c.id                                                                        AS card_id,
  c.name,
  c.set_name,
  c.latest_price                                                              AS price,
  c.genre,
  c.sealed,
  col.user_id                                                                 AS seller_id,
  up.username                                                                 AS seller_username,
  gc.label                                                                    AS grade_label,
  gco.slug                                                                    AS grading_company,
  CASE
    WHEN (SELECT qnorm FROM q) = '' THEN 1.0
    ELSE greatest(
      ts_rank_cd(c.search_vector, plainto_tsquery('simple', (SELECT qnorm FROM q))),
      similarity(c.name, (SELECT qnorm FROM q))
    )
  END                                                                         AS score,
  (coalesce(c.set_name,'') || ' • ' || coalesce(c.name,''))                   AS snippet,
  jsonb_build_object(
    'seller', up.username,
    'price', c.latest_price,
    'grading', gco.slug,
    'grade', gc.label
  )                                                                           AS reason
FROM public.collection_items ci
JOIN public.collections   col ON col.id = ci.collection_id
                              AND coalesce(col.is_storefront, false) = true
JOIN public.cards         c   ON c.id = ci.ref_id
LEFT JOIN public.user_profile     up  ON up.user_id = col.user_id
LEFT JOIN public.grade_conditions gc  ON gc.id = ci.grade_condition_id
LEFT JOIN public.grading_companies gco ON gco.id = gc.company_id
WHERE c.latest_price IS NOT NULL
  AND ci.quantity > ci.held_quantity
  AND (
        (SELECT qnorm FROM q) = ''
        OR c.search_vector @@ plainto_tsquery('simple', (SELECT qnorm FROM q))
        OR similarity(c.name, (SELECT qnorm FROM q)) > 0.2
      )
  AND (p_genre     IS NULL OR public.canonical_genre(c.genre) = p_genre)
  AND (p_sets      IS NULL OR c.set_name = ANY(p_sets))
  AND (p_min_price IS NULL OR c.latest_price >= p_min_price)
  AND (p_max_price IS NULL OR c.latest_price <= p_max_price)
  AND (p_sealed    IS NULL OR c.sealed = p_sealed)
  AND (
        p_grading IS NULL
        OR gco.slug = ANY(p_grading)
        OR ('raw' = ANY(p_grading) AND ci.grade_condition_id IS NULL)
      )
ORDER BY score DESC, price DESC
LIMIT p_limit;
$function$;
