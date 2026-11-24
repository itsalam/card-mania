-- ITS-121 + ITS-122: offers and transactions change only through RPCs.
--
-- Before this migration the client wrote these tables directly:
--   * offers_update / transactions_update were USING (buyer OR seller) with no WITH CHECK,
--     so either party could set any status (a buyer could accept their own offer or mark a
--     transaction completed).
--   * offers_insert let a buyer insert an offer with any status, and transactions_insert
--     let a seller create a transaction for a still-pending offer.
--   * Creating an offer (offer, then offer_items) and accepting one (offer update, then
--     transaction insert) were two separate writes each; a failure in between left
--     orphaned rows. Accepting never checked stock and left competing offers open.
--
-- Now every write is a SECURITY DEFINER function that checks the caller and the allowed
-- status transition, in one transaction:
--
--   offers        create_offer      buyer               (new)          -> pending
--                 accept_offer      seller              pending        -> accepted  (+ transaction)
--                 decline_offer     seller              pending        -> declined
--                 cancel_offer      buyer               pending        -> cancelled
--   transactions  mark_transaction_shipped     seller   pending        -> shipped
--                 confirm_transaction_receipt  buyer    shipped        -> completed (offer -> completed)
--                 dispute_transaction          either   pending|shipped -> disputed
--                 set_transaction_shipping_address  buyer, while pending
--
-- create_offer only accepts items that are currently listed (listed storefront, storefront
-- collection, in stock); unlisted items are offerable only by their seller.
--
-- accept_offer locks the offer and the seller's collection_items, checks stock, creates the
-- transaction (the existing transactions_after_insert trigger decrements inventory), then
-- declines other pending offers that the remaining stock can no longer fill.
--
-- The write policies are dropped and INSERT/UPDATE/DELETE revoked from anon/authenticated,
-- so the RPCs are the only path. SELECT policies are unchanged.

-- ── helpers ──────────────────────────────────────────────────────────────────

-- Locks and returns the offer, raising unless the caller is the given party and the
-- offer is in one of the allowed statuses.
create or replace function public._lock_offer_for_transition(
  p_offer_id uuid,
  p_actor text,               -- 'buyer' | 'seller' | 'either'
  p_allowed_statuses text[],
  p_action text               -- for error messages, e.g. 'accept'
)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_offer from public.offers where id = p_offer_id for update;

  -- Non-participants get the same answer as a missing offer.
  if not found or v_uid not in (v_offer.buyer_id, v_offer.seller_id) then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;

  if (p_actor = 'buyer' and v_uid <> v_offer.buyer_id)
     or (p_actor = 'seller' and v_uid <> v_offer.seller_id) then
    raise exception 'Only the % can % this offer', p_actor, p_action using errcode = '42501';
  end if;

  if not (v_offer.status = any (p_allowed_statuses)) then
    raise exception 'Cannot % an offer that is %', p_action, v_offer.status using errcode = '22023';
  end if;

  return v_offer;
end;
$$;

-- Same for a transaction, addressed by its offer id (what the app routes on).
create or replace function public._lock_transaction_for_transition(
  p_offer_id uuid,
  p_actor text,
  p_allowed_statuses text[],
  p_action text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_tx public.transactions;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_offer from public.offers where id = p_offer_id;
  if not found or v_uid not in (v_offer.buyer_id, v_offer.seller_id) then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;

  select * into v_tx from public.transactions where offer_id = p_offer_id for update;
  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;

  if (p_actor = 'buyer' and v_uid <> v_offer.buyer_id)
     or (p_actor = 'seller' and v_uid <> v_offer.seller_id) then
    raise exception 'Only the % can % this transaction', p_actor, p_action using errcode = '42501';
  end if;

  if not (v_tx.status = any (p_allowed_statuses)) then
    raise exception 'Cannot % a transaction that is %', p_action, v_tx.status using errcode = '22023';
  end if;

  return v_tx;
end;
$$;

revoke all on function public._lock_offer_for_transition(uuid, text, text[], text) from public, anon, authenticated;
revoke all on function public._lock_transaction_for_transition(uuid, text, text[], text) from public, anon, authenticated;

-- ── offers ───────────────────────────────────────────────────────────────────

-- p_items: [{ collection_item_id, quantity, offered_price_per_unit, card_snapshot? }, ...]
-- p_total_amount: optional override (the native cart lets a single-seller buyer edit the
-- total); defaults to sum(quantity * offered_price_per_unit).
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

  -- Every item must be the seller's and in stock (summing duplicates of one listing).
  select r.collection_item_id, r.requested, ci.quantity as available, ci.user_id
    into v_bad
    from (select collection_item_id, sum(quantity) as requested
            from jsonb_to_recordset(p_items) as i(collection_item_id uuid, quantity int, offered_price_per_unit numeric, card_snapshot jsonb)
           group by collection_item_id) r
    left join public.collection_items ci on ci.id = r.collection_item_id
   where ci.id is null or ci.user_id <> p_seller_id or ci.quantity < r.requested
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
  v_competitors uuid[];
  v_short record;
begin
  v_offer := public._lock_offer_for_transition(p_offer_id, 'seller', array['pending'], 'accept');

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

  select r.requested, ci.quantity as available
    into v_short
    from (select collection_item_id, sum(quantity) as requested
            from public.offer_items where offer_id = p_offer_id
           group by collection_item_id) r
    left join public.collection_items ci on ci.id = r.collection_item_id
   where r.collection_item_id is null or ci.id is null or ci.quantity < r.requested
   limit 1;
  if found then
    raise exception 'Not enough stock to accept this offer (% left, % requested)',
      coalesce(v_short.available, 0), v_short.requested
      using errcode = '22023';
  end if;

  -- Find competitors before inventory moves: the decrement trigger deletes listings that
  -- hit zero, which nulls offer_items.collection_item_id (ON DELETE SET NULL).
  select coalesce(array_agg(distinct oi.offer_id), '{}')
    into v_competitors
    from public.offer_items oi
    join public.offers o on o.id = oi.offer_id
   where oi.collection_item_id = any (v_item_ids)
     and o.status = 'pending'
     and o.id <> p_offer_id;

  update public.offers set status = 'accepted' where id = p_offer_id;

  insert into public.transactions (offer_id) values (p_offer_id)
  returning * into v_tx;

  -- Decline competing offers the remaining stock can no longer fill.
  update public.offers o
     set status = 'declined'
   where o.id = any (v_competitors)
     and o.status = 'pending'
     and exists (
       select 1
         from (select collection_item_id, sum(quantity) as requested
                 from public.offer_items where offer_id = o.id
                group by collection_item_id) r
         left join public.collection_items ci on ci.id = r.collection_item_id
        where ci.id is null or ci.quantity < r.requested
     );

  return v_tx;
end;
$$;

create or replace function public.decline_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
begin
  perform public._lock_offer_for_transition(p_offer_id, 'seller', array['pending'], 'decline');
  update public.offers set status = 'declined' where id = p_offer_id returning * into v_offer;
  return v_offer;
end;
$$;

create or replace function public.cancel_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
begin
  perform public._lock_offer_for_transition(p_offer_id, 'buyer', array['pending'], 'cancel');
  update public.offers set status = 'cancelled' where id = p_offer_id returning * into v_offer;
  return v_offer;
end;
$$;

-- ── transactions ─────────────────────────────────────────────────────────────

create or replace function public.mark_transaction_shipped(p_offer_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  perform public._lock_transaction_for_transition(p_offer_id, 'seller', array['pending'], 'ship');
  update public.transactions set status = 'shipped' where offer_id = p_offer_id returning * into v_tx;
  return v_tx;
end;
$$;

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
  return v_tx;
end;
$$;

create or replace function public.dispute_transaction(p_offer_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  perform public._lock_transaction_for_transition(p_offer_id, 'either', array['pending', 'shipped'], 'dispute');
  update public.transactions set status = 'disputed' where offer_id = p_offer_id returning * into v_tx;
  return v_tx;
end;
$$;

create or replace function public.set_transaction_shipping_address(p_offer_id uuid, p_address jsonb)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  if p_address is null or jsonb_typeof(p_address) <> 'object' then
    raise exception 'A shipping address is required' using errcode = '22023';
  end if;
  perform public._lock_transaction_for_transition(p_offer_id, 'buyer', array['pending'], 'change the shipping address of');
  update public.transactions set buyer_shipping_address = p_address
   where offer_id = p_offer_id returning * into v_tx;
  return v_tx;
end;
$$;

revoke all on function public.create_offer(uuid, jsonb, text, numeric) from public, anon;
revoke all on function public.accept_offer(uuid) from public, anon;
revoke all on function public.decline_offer(uuid) from public, anon;
revoke all on function public.cancel_offer(uuid) from public, anon;
revoke all on function public.mark_transaction_shipped(uuid) from public, anon;
revoke all on function public.confirm_transaction_receipt(uuid) from public, anon;
revoke all on function public.dispute_transaction(uuid) from public, anon;
revoke all on function public.set_transaction_shipping_address(uuid, jsonb) from public, anon;

grant execute on function public.create_offer(uuid, jsonb, text, numeric) to authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;
grant execute on function public.decline_offer(uuid) to authenticated;
grant execute on function public.cancel_offer(uuid) to authenticated;
grant execute on function public.mark_transaction_shipped(uuid) to authenticated;
grant execute on function public.confirm_transaction_receipt(uuid) to authenticated;
grant execute on function public.dispute_transaction(uuid) to authenticated;
grant execute on function public.set_transaction_shipping_address(uuid, jsonb) to authenticated;

-- ── close the direct-write paths ─────────────────────────────────────────────

drop policy if exists "offers_insert" on public.offers;
drop policy if exists "offers_update" on public.offers;
drop policy if exists "offer_items_insert" on public.offer_items;
drop policy if exists "transactions_insert" on public.transactions;
drop policy if exists "transactions_update" on public.transactions;

revoke insert, update, delete, truncate on public.offers from anon, authenticated;
revoke insert, update, delete, truncate on public.offer_items from anon, authenticated;
revoke insert, update, delete, truncate on public.transactions from anon, authenticated;

