-- ITS-134: "List for Sale" with a seller asking price, and mirrors that can't eat PC copies.
--
-- Decisions (Nov 26, 2026; docs/collections/list-for-sale.md):
--   * List for Sale moves n copies out of a PC (Vault) row into an automatic "For Sale"
--     storefront collection, with an asking price (required, prefilled with the market price
--     for the grade). Remove from Sale moves them back. The Vault total doesn't change.
--   * Mirrors are linked explicitly (collection_items.mirror_of) instead of matched on card +
--     grade + variants. The old key matching skipped creating a Vault mirror when a PC row of
--     the same card existed, then updated or deleted that PC row along with the listing:
--     own 3, list 1, sell or delist it, and all 3 were gone.
--   * Asking price lives on the listing and is copied to its mirrors. Listings without one
--     (everything listed before this) sell at the market price, labeled as such in the app.
--
-- Chain: storefront listing ─mirror_of─▶ Selling row ─mirror_of─▶ Vault row.
--   insert source  → creates its mirror (storefront → Selling → Vault)
--   update either  → copied to the other side (no-op updates stop the ping-pong)
--   delete mirror  → deletes its source (so the whole chain goes); delete source → FK cascade
-- Held listings (ITS-135) still can't be deleted or shrunk below the hold, from either end.

-- ── columns ─────────────────────────────────────────────────────────────────

alter table public.collection_items
  add column if not exists mirror_of uuid references public.collection_items (id) on delete cascade,
  add column if not exists asking_price_cents integer,
  add column if not exists asking_currency text not null default 'USD';

alter table public.collection_items drop constraint if exists collection_items_asking_price_check;
alter table public.collection_items
  add constraint collection_items_asking_price_check
  check (asking_price_cents is null or asking_price_cents > 0);
alter table public.collection_items drop constraint if exists collection_items_asking_currency_check;
alter table public.collection_items
  add constraint collection_items_asking_currency_check check (asking_currency in ('USD'));

create index if not exists collection_items_mirror_of_idx on public.collection_items (mirror_of);

comment on column public.collection_items.mirror_of is
  'The row this one mirrors (storefront listing → Selling → Vault). ITS-134.';
comment on column public.collection_items.asking_price_cents is
  'Seller''s asking price per copy, USD cents. Null = sells at the market price (older listings). ITS-134.';

alter table public.collections
  add column if not exists is_listing_default boolean not null default false;
create unique index if not exists collections_one_listing_default
  on public.collections (user_id) where is_listing_default;
comment on column public.collections.is_listing_default is
  'The storefront collection List for Sale puts cards into (created on first use). ITS-134.';

-- ── retire the key-matching mirror triggers ─────────────────────────────────

drop trigger if exists trg_selling_items_from_vault on public.collection_items;
drop trigger if exists trg_selling_items_to_vault on public.collection_items;
drop trigger if exists trg_selling_items_update_source on public.collection_items;
drop trigger if exists trg_selling_items_update_to_vault on public.collection_items;
drop trigger if exists trg_storefront_items_from_selling on public.collection_items;
drop trigger if exists trg_storefront_items_to_selling on public.collection_items;
drop function if exists public.sync_selling_item_remove_from_vault();
drop function if exists public.sync_selling_item_to_vault();
drop function if exists public.sync_selling_item_update_to_source();
drop function if exists public.sync_selling_item_update_to_vault();
drop function if exists public.sync_storefront_item_remove_from_selling();
drop function if exists public.sync_storefront_item_to_selling();

-- ── mirror helpers ──────────────────────────────────────────────────────────

-- Where a row in this collection is mirrored to: storefront → Selling, Selling → Vault.
create or replace function public._mirror_target_collection(p_collection_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
           when coalesce(c.is_storefront, false) then
             (select s.id from public.collections s
               where s.user_id = c.user_id and coalesce(s.is_selling, false)
               order by s.created_at limit 1)
           when coalesce(c.is_selling, false) then
             (select v.id from public.collections v
               where v.user_id = c.user_id and coalesce(v.is_vault, false)
               order by v.created_at limit 1)
         end
    from public.collections c
   where c.id = p_collection_id
$$;

create or replace function public._insert_mirror(p_src public.collection_items)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := public._mirror_target_collection(p_src.collection_id);
begin
  if v_target is null or v_target = p_src.collection_id then
    return;
  end if;
  if exists (select 1 from public.collection_items where mirror_of = p_src.id) then
    return;
  end if;
  insert into public.collection_items (
    collection_id, collection_ref, mirror_of, user_id, item_kind, ref_id, quantity, position,
    grading_company, variants, grade_condition_id, asking_price_cents, asking_currency
  )
  values (
    v_target, p_src.collection_id, p_src.id, p_src.user_id, p_src.item_kind, p_src.ref_id,
    p_src.quantity, 0, p_src.grading_company, p_src.variants, p_src.grade_condition_id,
    p_src.asking_price_cents, p_src.asking_currency
  );
end;
$$;

-- Removes a row's mirrors without the mirrors taking the row down with them.
-- Two statements: one statement can't both update and delete the same row.
create or replace function public._drop_mirrors(p_src_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  with unlinked as (
    update public.collection_items set mirror_of = null
     where mirror_of = p_src_id
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from unlinked;
  delete from public.collection_items where id = any (v_ids);
end;
$$;

revoke all on function public._mirror_target_collection(uuid) from public, anon, authenticated;
revoke all on function public._insert_mirror(public.collection_items) from public, anon, authenticated;
revoke all on function public._drop_mirrors(uuid) from public, anon, authenticated;

-- ── backfill links for existing mirrors ─────────────────────────────────────

-- Selling rows that mirror a storefront row (collection_ref = the storefront collection).
update public.collection_items m
   set mirror_of = pick.src_id
  from (
    select distinct on (s.id) m2.id as mirror_id, s.id as src_id
      from public.collection_items m2
      join public.collections sc on sc.id = m2.collection_id and coalesce(sc.is_selling, false)
      join public.collection_items s
        on s.collection_id = m2.collection_ref
       and s.user_id = m2.user_id
       and s.item_kind = m2.item_kind
       and s.ref_id = m2.ref_id
       and s.grade_condition_id is not distinct from m2.grade_condition_id
       and s.grading_company is not distinct from m2.grading_company
       and coalesce(s.variants, '{}') = coalesce(m2.variants, '{}')
     where m2.mirror_of is null
     order by s.id, m2.created_at
  ) pick
 where m.id = pick.mirror_id;

-- Vault rows that mirror a Selling row (collection_ref = the Selling collection).
update public.collection_items v
   set mirror_of = pick.src_id
  from (
    select distinct on (m.id) v2.id as mirror_id, m.id as src_id
      from public.collection_items v2
      join public.collections vc on vc.id = v2.collection_id and coalesce(vc.is_vault, false)
      join public.collection_items m
        on m.collection_id = v2.collection_ref
       and m.user_id = v2.user_id
       and m.item_kind = v2.item_kind
       and m.ref_id = v2.ref_id
       and m.grade_condition_id is not distinct from v2.grade_condition_id
       and m.grading_company is not distinct from v2.grading_company
       and coalesce(m.variants, '{}') = coalesce(v2.variants, '{}')
     where v2.mirror_of is null
     order by m.id, v2.created_at
  ) pick
 where v.id = pick.mirror_id;

-- Fill in mirrors the old dedupe skipped. A missing Vault mirror means a PC row of the same
-- card stood in for it, so its copies come out of that PC row: the Vault total stays the same.
do $$
declare
  r public.collection_items;
  v_vault uuid;
  v_pc public.collection_items;
  v_take integer;
begin
  for r in
    select s.* from public.collection_items s
      join public.collections c on c.id = s.collection_id and coalesce(c.is_storefront, false)
     where not exists (select 1 from public.collection_items m where m.mirror_of = s.id)
  loop
    perform public._insert_mirror(r);
  end loop;

  for r in
    select s.* from public.collection_items s
      join public.collections c on c.id = s.collection_id and coalesce(c.is_selling, false)
     where not exists (select 1 from public.collection_items m where m.mirror_of = s.id)
  loop
    v_vault := public._mirror_target_collection(r.collection_id);
    continue when v_vault is null;

    select p.* into v_pc
      from public.collection_items p
     where p.collection_id = v_vault
       and p.mirror_of is null
       and p.item_kind = r.item_kind
       and p.ref_id = r.ref_id
       and p.grade_condition_id is not distinct from r.grade_condition_id
       and p.grading_company is not distinct from r.grading_company
       and coalesce(p.variants, '{}') = coalesce(r.variants, '{}')
     order by p.quantity desc
     limit 1;

    perform public._insert_mirror(r);

    if v_pc.id is not null then
      v_take := least(v_pc.quantity, r.quantity);
      if v_pc.quantity - v_take <= 0 then
        delete from public.collection_items where id = v_pc.id;
      else
        update public.collection_items set quantity = quantity - v_take where id = v_pc.id;
      end if;
    end if;
    v_pc := null;
  end loop;
end;
$$;

-- ── new mirror triggers ─────────────────────────────────────────────────────

create or replace function public._mirror_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._insert_mirror(new);
  return new;
end;
$$;

create or replace function public._mirror_on_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 6 then
    return new;
  end if;

  if new.collection_id is distinct from old.collection_id then
    -- Moved to another collection: re-mirror from scratch.
    perform public._drop_mirrors(new.id);
    perform public._insert_mirror(new);
  else
    update public.collection_items m
       set item_kind = new.item_kind, ref_id = new.ref_id, quantity = new.quantity,
           grade_condition_id = new.grade_condition_id, grading_company = new.grading_company,
           variants = new.variants, asking_price_cents = new.asking_price_cents,
           asking_currency = new.asking_currency, updated_at = now()
     where m.mirror_of = new.id
       and (m.item_kind, m.ref_id, m.quantity, m.grade_condition_id, m.grading_company,
            coalesce(m.variants, '{}'), m.asking_price_cents, m.asking_currency)
           is distinct from
           (new.item_kind, new.ref_id, new.quantity, new.grade_condition_id, new.grading_company,
            coalesce(new.variants, '{}'), new.asking_price_cents, new.asking_currency);
  end if;

  -- An edit made on a mirror (e.g. quantity in the Selling tab) goes back to its source.
  if new.mirror_of is not null then
    update public.collection_items s
       set item_kind = new.item_kind, ref_id = new.ref_id, quantity = new.quantity,
           grade_condition_id = new.grade_condition_id, grading_company = new.grading_company,
           variants = new.variants, asking_price_cents = new.asking_price_cents,
           asking_currency = new.asking_currency, updated_at = now()
     where s.id = new.mirror_of
       and (s.item_kind, s.ref_id, s.quantity, s.grade_condition_id, s.grading_company,
            coalesce(s.variants, '{}'), s.asking_price_cents, s.asking_currency)
           is distinct from
           (new.item_kind, new.ref_id, new.quantity, new.grade_condition_id, new.grading_company,
            coalesce(new.variants, '{}'), new.asking_price_cents, new.asking_currency);
  end if;

  return new;
end;
$$;

-- Deleting a mirror (from Selling or the Vault) deletes what it mirrors, which takes the
-- rest of the chain with it. Deleting the source cascades through the foreign key.
create or replace function public._mirror_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.mirror_of is not null then
    delete from public.collection_items where id = old.mirror_of;
  end if;
  return old;
end;
$$;

drop trigger if exists collection_items_mirror_insert on public.collection_items;
create trigger collection_items_mirror_insert
  after insert on public.collection_items
  for each row execute function public._mirror_on_insert();

drop trigger if exists collection_items_mirror_update on public.collection_items;
create trigger collection_items_mirror_update
  after update of collection_id, item_kind, ref_id, quantity, grade_condition_id, grading_company,
                  variants, asking_price_cents, asking_currency
  on public.collection_items
  for each row execute function public._mirror_on_update();

drop trigger if exists collection_items_mirror_delete on public.collection_items;
create trigger collection_items_mirror_delete
  after delete on public.collection_items
  for each row
  when (old.mirror_of is not null)
  execute function public._mirror_on_delete();

-- Marking a collection as a storefront mirrors its cards into Selling; unmarking removes
-- those mirrors (and their Vault mirrors) but keeps the cards.
create or replace function public.sync_storefront_collection_to_selling()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.collection_items;
begin
  if new.is_storefront is not distinct from old.is_storefront then
    return new;
  end if;

  if coalesce(new.is_storefront, false) then
    for r in select * from public.collection_items where collection_id = new.id loop
      perform public._insert_mirror(r);
    end loop;
  else
    for r in select * from public.collection_items where collection_id = new.id loop
      perform public._drop_mirrors(r.id);
    end loop;
  end if;
  return new;
end;
$$;

-- ── ITS-135 transfer, following the links ───────────────────────────────────

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

  for v_item in
    select * from public.offer_items where offer_id = v_offer.id order by id
  loop
    v_listing := null;
    v_selling_row := null;
    v_vault_row := null;
    v_new_id := null;
    v_photo_source := null;

    if v_item.collection_item_id is not null then
      select * into v_listing from public.collection_items where id = v_item.collection_item_id for update;
    end if;
    if v_listing.id is not null then
      select id into v_selling_row from public.collection_items where mirror_of = v_listing.id limit 1;
      if v_selling_row is not null then
        select id into v_vault_row from public.collection_items where mirror_of = v_selling_row limit 1;
      end if;
    end if;

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

    -- Seller side: release the hold, then mark the copies sold. The listing's mirrors follow
    -- it (mirror triggers), and the seller's PC rows are never touched.
    if v_tx.holds_stock and v_listing.id is not null then
      update public.collection_items
         set held_quantity = greatest(0, held_quantity - v_item.quantity)
       where id = v_listing.id;

      v_left := greatest(0, v_listing.quantity - v_item.quantity);
      if v_left = 0 then
        delete from public.collection_items where id = v_listing.id;
      else
        update public.collection_items set quantity = v_left where id = v_listing.id;
      end if;
    end if;
  end loop;

  update public.transactions set transferred_at = now() where id = v_tx.id;
end;
$$;

revoke all on function public._transfer_transaction_items(uuid) from public, anon, authenticated;

-- ── list / unlist / price ───────────────────────────────────────────────────

-- The caller's "For Sale" storefront collection, created (and its storefront listed) on first use.
create or replace function public._listing_default_collection(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
  v_n integer := 1;
begin
  select id into v_id from public.collections where user_id = p_user_id and is_listing_default;
  if v_id is null then
    perform public.ensure_default_collections_for_user(p_user_id);
    v_name := 'For Sale';
    while exists (select 1 from public.collections where user_id = p_user_id and lower(name) = lower(v_name)) loop
      v_n := v_n + 1;
      v_name := 'For Sale ' || v_n;
    end loop;
    insert into public.collections (user_id, name, is_storefront, is_listing_default)
    values (p_user_id, v_name, true, true)
    returning id into v_id;
  end if;

  -- Publish: the storefront lists this collection and is listed.
  insert into public.storefronts (user_id, collection_ids, is_listed, listed_at)
  values (p_user_id, array[v_id], true, now())
  on conflict (user_id) do update
    set collection_ids = case when v_id = any (public.storefronts.collection_ids)
                              then public.storefronts.collection_ids
                              else public.storefronts.collection_ids || v_id end,
        is_listed = true,
        listed_at = coalesce(public.storefronts.listed_at, now()),
        updated_at = now();
  return v_id;
end;
$$;

revoke all on function public._listing_default_collection(uuid) from public, anon, authenticated;

-- Moves p_quantity copies out of a PC row into the "For Sale" storefront at an asking price.
-- Returns the new listing.
create or replace function public.list_for_sale(
  p_item_id uuid,
  p_quantity integer,
  p_asking_price_cents integer
)
returns public.collection_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pc public.collection_items;
  v_listing public.collection_items;
  v_target uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select ci.* into v_pc
    from public.collection_items ci
    join public.collections c on c.id = ci.collection_id and coalesce(c.is_vault, false)
   where ci.id = p_item_id and ci.user_id = v_uid and ci.mirror_of is null
   for update of ci;
  if not found then
    raise exception 'Only cards in your collection (PC) can be listed' using errcode = 'P0002';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > v_pc.quantity then
    raise exception 'You can list between 1 and % of this card', v_pc.quantity using errcode = '22023';
  end if;
  if p_asking_price_cents is null or p_asking_price_cents <= 0 then
    raise exception 'Set an asking price above zero' using errcode = '22023';
  end if;

  v_target := public._listing_default_collection(v_uid);

  insert into public.collection_items (
    collection_id, user_id, item_kind, ref_id, quantity, grade_condition_id, grading_company,
    variants, asking_price_cents
  )
  values (
    v_target, v_uid, v_pc.item_kind, v_pc.ref_id, p_quantity, v_pc.grade_condition_id,
    v_pc.grading_company, coalesce(v_pc.variants, '{}'), p_asking_price_cents
  )
  returning * into v_listing;

  -- The copies' photos go with them (shared files).
  insert into public.collection_item_images (
    collection_item_id, user_id, image_cache_id, storage_path, width, height, position, is_primary
  )
  select v_listing.id, v_uid, img.image_cache_id, img.storage_path, img.width, img.height,
         img.position, img.is_primary
    from public.collection_item_images img
   where img.collection_item_id = v_pc.id;

  if v_pc.quantity = p_quantity then
    delete from public.collection_items where id = v_pc.id;
  else
    update public.collection_items set quantity = quantity - p_quantity where id = v_pc.id;
  end if;

  return v_listing;
end;
$$;

-- Takes a listing off sale and moves its copies back into PC. Accepts the listing or any of
-- its mirrors. Returns the PC row.
create or replace function public.unlist_item(p_item_id uuid)
returns public.collection_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_listing public.collection_items;
  v_vault uuid;
  v_pc public.collection_items;
  v_id uuid := p_item_id;
  v_up uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- Walk up to the listing (a mirror's mirror_of chain ends at the storefront row).
  loop
    select mirror_of into v_up from public.collection_items where id = v_id and user_id = v_uid;
    exit when v_up is null;
    v_id := v_up;
  end loop;

  select ci.* into v_listing
    from public.collection_items ci
    join public.collections c on c.id = ci.collection_id and coalesce(c.is_storefront, false)
   where ci.id = v_id and ci.user_id = v_uid
   for update of ci;
  if not found then
    raise exception 'This card isn''t listed for sale' using errcode = 'P0002';
  end if;
  if v_listing.held_quantity > 0 then
    raise exception 'This card is on hold for a sale in progress' using errcode = '23514';
  end if;

  perform public.ensure_default_collections_for_user(v_uid);
  select id into v_vault from public.collections where user_id = v_uid and coalesce(is_vault, false)
   order by created_at limit 1;

  select p.* into v_pc
    from public.collection_items p
   where p.collection_id = v_vault and p.mirror_of is null
     and p.item_kind = v_listing.item_kind and p.ref_id = v_listing.ref_id
     and p.grade_condition_id is not distinct from v_listing.grade_condition_id
     and p.grading_company is not distinct from v_listing.grading_company
     and coalesce(p.variants, '{}') = coalesce(v_listing.variants, '{}')
   order by p.created_at
   limit 1
   for update;

  if v_pc.id is not null then
    update public.collection_items set quantity = quantity + v_listing.quantity
     where id = v_pc.id
    returning * into v_pc;
  else
    insert into public.collection_items (
      collection_id, user_id, item_kind, ref_id, quantity, grade_condition_id, grading_company, variants
    )
    values (
      v_vault, v_uid, v_listing.item_kind, v_listing.ref_id, v_listing.quantity,
      v_listing.grade_condition_id, v_listing.grading_company, coalesce(v_listing.variants, '{}')
    )
    returning * into v_pc;

    insert into public.collection_item_images (
      collection_item_id, user_id, image_cache_id, storage_path, width, height, position, is_primary
    )
    select v_pc.id, v_uid, img.image_cache_id, img.storage_path, img.width, img.height,
           img.position, img.is_primary
      from public.collection_item_images img
     where img.collection_item_id = v_listing.id;
  end if;

  delete from public.collection_items where id = v_listing.id;
  return v_pc;
end;
$$;

-- Sets the asking price on a listing (or any of its mirrors; the change reaches all of them).
create or replace function public.set_asking_price(p_item_id uuid, p_asking_price_cents integer)
returns public.collection_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.collection_items;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_asking_price_cents is null or p_asking_price_cents <= 0 then
    raise exception 'Set an asking price above zero' using errcode = '22023';
  end if;

  update public.collection_items ci
     set asking_price_cents = p_asking_price_cents
   where ci.id = p_item_id
     and ci.user_id = auth.uid()
     and (ci.mirror_of is not null
          or exists (select 1 from public.collections c where c.id = ci.collection_id and coalesce(c.is_storefront, false)))
  returning * into v_row;
  if v_row.id is null then
    raise exception 'This card isn''t listed for sale' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke all on function public.list_for_sale(uuid, integer, integer) from public, anon;
revoke all on function public.unlist_item(uuid) from public, anon;
revoke all on function public.set_asking_price(uuid, integer) from public, anon;
grant execute on function public.list_for_sale(uuid, integer, integer) to authenticated;
grant execute on function public.unlist_item(uuid) to authenticated;
grant execute on function public.set_asking_price(uuid, integer) to authenticated;

-- ── read paths: asking price (and the hold) ─────────────────────────────────
-- Generated from the current definitions; changes are the asking_price_cents / held_quantity /
-- mirror_of additions.

drop function if exists public._marketplace_base_listings();
CREATE FUNCTION public._marketplace_base_listings()
 RETURNS TABLE(collection_item_id uuid, collection_id uuid, storefront_id uuid, seller_id uuid, seller_username text, seller_display_name text, seller_avatar_url text, item_kind item_kind, ref_id uuid, grade_condition_id uuid, grading_company text, quantity integer, variants text[], listed_at timestamp with time zone, name text, set_name text, latest_price numeric, grades_prices jsonb, genre text, front_id text, back_id text, price_key text, market_value integer, popularity_score numeric, sealed boolean, asking_price_cents integer)
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
    coalesce(c.sealed, false)                                             as sealed,
    ci.asking_price_cents
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
revoke all on function public._marketplace_base_listings() from public;
grant execute on function public._marketplace_base_listings() to anon, authenticated, service_role;

drop function if exists public.get_recommended_listings(integer);
CREATE FUNCTION public.get_recommended_listings(result_limit integer DEFAULT 20)
 RETURNS TABLE(collection_item_id uuid, collection_id uuid, storefront_id uuid, seller_id uuid, seller_username text, seller_display_name text, seller_avatar_url text, item_kind item_kind, ref_id uuid, grade_condition_id uuid, grading_company text, quantity integer, variants text[], listed_at timestamp with time zone, name text, set_name text, latest_price numeric, grades_prices jsonb, genre text, front_id text, back_id text, price_key text, market_value integer, popularity_score numeric, asking_price_cents integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with
  my_genres as (
    select distinct public.canonical_genre(c.genre) as genre
    from public.collection_items ci
    join public.collections col on col.id = ci.collection_id
    join public.cards c on c.id = ci.ref_id
    where col.user_id = auth.uid()
      and ci.item_kind = 'card'
      and c.genre is not null
  ),
  my_owned as (
    select distinct ci.ref_id as card_id
    from public.collection_items ci
    join public.collections col on col.id = ci.collection_id
    where col.user_id = auth.uid()
      and ci.item_kind = 'card'
      and coalesce(col.is_wishlist, false) = false
      and ci.quantity > 0
  )
  select
    b.collection_item_id, b.collection_id, b.storefront_id, b.seller_id,
    b.seller_username, b.seller_display_name, b.seller_avatar_url, b.item_kind,
    b.ref_id, b.grade_condition_id, b.grading_company, b.quantity, b.variants,
    b.listed_at, b.name, b.set_name, b.latest_price, b.grades_prices, b.genre,
    b.front_id, b.back_id, b.price_key, b.market_value, b.popularity_score,
    b.asking_price_cents
  from public._marketplace_base_listings() b
  where b.seller_id is distinct from auth.uid()
    and not exists (select 1 from my_owned o where o.card_id = b.ref_id)
  order by
    (case when public.canonical_genre(b.genre) in (select genre from my_genres)
          then 0 else 1 end),
    b.popularity_score desc nulls last,
    b.listed_at desc nulls last,
    b.collection_item_id
  limit coalesce(result_limit, 20);
$function$;
revoke all on function public.get_recommended_listings(integer) from public;
grant execute on function public.get_recommended_listings(integer) to anon, authenticated, service_role;

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
    select l.id, l.collection_id, l.user_id, l.ref_id, l.grade_condition_id, l.grading_company, l.asking_price_cents,
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
  -- What the buyer would pay: the asking price, or the market price for older listings.
  cross join lateral (select coalesce(l.asking_price_cents, nullif(round((c.grades_prices ->> l.price_key)::numeric), 0)::int) as cents) cur
  cross join lateral (select nullif(round((w.price_snapshot ->> l.price_key)::numeric), 0)::int as cents) snap
$function$;

drop function if exists public.collection_item_query(uuid, timestamptz, text, integer, boolean, integer, text, integer);
create function public.collection_item_query(
  p_collection_id uuid,
  p_page_param timestamptz default null,
  p_search text default null,
  p_page_size integer default 20,
  p_group boolean default false,
  p_page_position integer default null,
  -- null: the collection's item_sort (offset paging) or custom (legacy cursor paging)
  p_sort text default null,
  -- rows to skip; sending it (0 for the first page) switches to offset paging
  p_page_offset integer default null
)
returns table (
  collection_item_id uuid, collection_id uuid, collection_ref uuid, user_id uuid,
  item_kind public.item_kind, ref_id uuid, grade_condition_id uuid, grading_company text,
  "position" integer, quantity integer, variants text[], created_at timestamptz,
  updated_at timestamptz, id uuid, name text, set_name text, latest_price numeric,
  grades_prices jsonb, genre text, last_updated timestamptz, front_id text, back_id text,
  extras text[], price_key text, collection_item_value integer, primary_image_cache_id uuid,
  primary_image_storage_path text, primary_image_width integer, primary_image_height integer,
  -- The row's legacy cursor (p_page_position / p_page_param). Offset clients ignore it.
  sort_position integer, sort_created_at timestamptz,
  -- ITS-134/135: on-hold copies, the seller's asking price, and the row this one mirrors.
  held_quantity integer, asking_price_cents integer, mirror_of uuid
)
language sql
stable
set search_path to 'public'
as $function$
with settings as (
    select case
             when p_page_offset is null then 'custom'
             else coalesce(
               p_sort,
               (select col.item_sort from public.collections col where col.id = p_collection_id),
               'custom')
           end as sort
),
raw as (
    select
        ci.id              as collection_item_id,
        ci.collection_id,
        ci.collection_ref,
        ci.user_id,
        ci.item_kind,
        ci.ref_id,
        ci.grade_condition_id,
        ci.grading_company,
        ci.position        as "position",
        ci.quantity,
        ci.held_quantity,
        ci.asking_price_cents,
        ci.mirror_of,
        ci.variants,
        ci.created_at,
        ci.updated_at,
        c.id,
        c.name,
        c.set_name,
        c.latest_price,
        c.grades_prices,
        c.genre,
        c.last_updated,
        c.front_id,
        c.back_id,
        c.extras,
        coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded') as price_key,
        cii.image_cache_id as primary_image_cache_id,
        cii.storage_path   as primary_image_storage_path,
        cii.width          as primary_image_width,
        cii.height         as primary_image_height
    from
        public.collection_items ci
        left join public.cards c
            on ci.item_kind = 'card'::public.item_kind and ci.ref_id = c.id
        left join public.grade_conditions gcnd on gcnd.id = ci.grade_condition_id
        left join public.grading_companies gc  on gc.id  = gcnd.company_id
        left join public.collection_item_images cii
            on cii.collection_item_id = ci.id and cii.is_primary
    where
        ci.collection_id = p_collection_id
        and (
            p_search is null
            or p_search = ''
            or (
                ci.item_kind = 'card'::public.item_kind
                and (
                    c.name % p_search
                    or c.set_name % p_search
                    or word_similarity(p_search, c.name)     > (select trgm_word_similarity_threshold from public.search_config where id = 1)
                    or word_similarity(p_search, c.set_name) > (select trgm_word_similarity_threshold from public.search_config where id = 1)
                )
            )
        )
),
valued as (
    select *, coalesce((grades_prices ->> price_key)::int, 0) as item_value
    from raw
),
base as (
    select
        v.*,
        max(v.created_at) over (partition by v.ref_id) as ref_latest_created_at,
        min(v.created_at) over (partition by v.ref_id) as ref_first_created_at,
        min(v."position") over (partition by v.ref_id) as ref_position,
        max(v.item_value) over (partition by v.ref_id) as ref_max_value,
        row_number() over (
            partition by v.ref_id
            order by v.created_at desc
        )                                                as ref_rownum
    from valued v
),
-- Scores only when sorting by popularity; otherwise an empty lookup.
pop as (
    select p.ref_id, p.score
    from public.card_popularity(
        case when (select sort from settings) = 'popular'
             then array(select distinct b.ref_id from base b where b.item_kind = 'card'::public.item_kind)
             else '{}'::uuid[] end
    ) p
),
keyed as (
    select
        b.*,
        case when p_group then b.ref_position else b."position" end                  as k_position,
        case when p_group then b.ref_latest_created_at else b.created_at end         as k_created_at,
        case when p_group then b.ref_first_created_at else b.created_at end          as k_first_created_at,
        -- 0 means no price for this grade: sort it last either way.
        nullif(case when p_group then b.ref_max_value else b.item_value end, 0)      as k_value,
        coalesce(pop.score, 0)                                                       as k_popularity
    from base b
    left join pop on pop.ref_id = b.ref_id
    where p_group = false or b.ref_rownum = 1
),
filtered as (
    select *
    from keyed
    where
        -- Legacy cursor paging (custom sort only).
        p_page_offset is not null
        or p_page_param is null
        or k_position > coalesce(p_page_position, 0)
        or (k_position = coalesce(p_page_position, 0) and k_created_at < p_page_param)
)
select
    r.collection_item_id,
    r.collection_id,
    r.collection_ref,
    r.user_id,
    r.item_kind,
    r.ref_id,
    r.grade_condition_id,
    r.grading_company,
    r."position",
    r.quantity,
    r.variants,
    r.created_at,
    r.updated_at,
    r.id,
    r.name,
    r.set_name,
    r.latest_price,
    r.grades_prices,
    r.genre,
    r.last_updated,
    r.front_id,
    r.back_id,
    r.extras,
    r.price_key,
    r.item_value as collection_item_value,
    r.primary_image_cache_id,
    r.primary_image_storage_path,
    r.primary_image_width,
    r.primary_image_height,
    r.k_position   as sort_position,
    r.k_created_at as sort_created_at,
    r.held_quantity,
    r.asking_price_cents,
    r.mirror_of
from filtered r
cross join settings s
order by
    case when s.sort = 'custom'     then r.k_position end asc,
    case when s.sort = 'oldest'     then r.k_first_created_at end asc,
    case when s.sort = 'price_desc' then r.k_value end desc nulls last,
    case when s.sort = 'price_asc'  then r.k_value end asc nulls last,
    case when s.sort = 'popular'    then r.k_popularity end desc,
    -- custom and newest, and the tie-break for everything else: newest first.
    r.k_created_at desc,
    r.ref_id,
    r.collection_item_id
limit coalesce(p_page_size, 20)
offset coalesce(p_page_offset, 0);
$function$;

grant execute on function public.collection_item_query(uuid, timestamptz, text, integer, boolean, integer, text, integer)
  to anon, authenticated, service_role;
