-- ITS-137: item attributes (cost basis, serial number, condition notes) and gain/loss.
-- Decisions (Nov 27, 2026): docs/collections/item-attributes.md.
--
--   * Cost basis is per copy, in cents. Unrealized gain = (market - cost) x quantity, over the
--     copies that have a cost.
--   * Cost basis and condition notes are private to the owner: collection_items rows are
--     readable by others (public collections, storefronts, offers), so they live in
--     collection_item_private (owner-only RLS), never on the row.
--   * A listing chain (storefront listing -> Selling mirror -> Vault mirror) keeps them once, on
--     the chain's root (the row with no mirror_of). Mirrors read through to it.
--   * The serial number (e.g. "12/99") is public, on the row, copied along the mirror chain,
--     and allowed only on a row holding one copy.
--   * A sale in the app sets the buyer's cost basis to the price paid per copy and records the
--     seller's realized gain (realized_sales, seller-only).

-- ── 1. Serial number on the row ─────────────────────────────────────────────

alter table public.collection_items
  add column if not exists serial_number text;

alter table public.collection_items drop constraint if exists collection_items_serial_number_check;
alter table public.collection_items
  add constraint collection_items_serial_number_check
  check (
    serial_number is null
    or (char_length(serial_number) between 1 and 32 and serial_number = btrim(serial_number) and quantity <= 1)
  );

comment on column public.collection_items.serial_number is
  'ITS-137: serial number of this copy (e.g. "12/99"). Only on rows holding one copy. Public.';

-- ── 2. Private attributes ───────────────────────────────────────────────────

create table if not exists public.collection_item_private (
  collection_item_id uuid primary key references public.collection_items (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  cost_basis_cents   integer check (cost_basis_cents is null or cost_basis_cents >= 0),
  condition_notes    text check (condition_notes is null or char_length(condition_notes) <= 1000),
  updated_at         timestamptz not null default now()
);

comment on table public.collection_item_private is
  'ITS-137: owner-only attributes of a collection row (cost basis per copy, condition notes). '
  'Kept on the root of a listing chain; written through set_item_details.';

create index if not exists collection_item_private_user_idx
  on public.collection_item_private (user_id);

alter table public.collection_item_private enable row level security;

drop policy if exists collection_item_private_owner_read on public.collection_item_private;
create policy collection_item_private_owner_read
  on public.collection_item_private
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.collection_item_private from anon, authenticated;
grant select on public.collection_item_private to authenticated;

-- ── 3. Realized sales (seller side) ─────────────────────────────────────────

create table if not exists public.realized_sales (
  id                 uuid primary key default gen_random_uuid(),
  seller_id          uuid not null references auth.users (id) on delete cascade,
  transaction_id     uuid references public.transactions (id) on delete set null,
  offer_item_id      uuid unique references public.offer_items (id) on delete set null,
  item_kind          public.item_kind not null default 'card',
  ref_id             uuid,
  grade_condition_id uuid,
  grading_company    text,
  quantity           integer not null check (quantity > 0),
  -- Per copy, in cents. cost_basis_cents is null when the seller never entered one.
  sale_price_cents   integer not null check (sale_price_cents >= 0),
  cost_basis_cents   integer check (cost_basis_cents is null or cost_basis_cents >= 0),
  realized_at        timestamptz not null default now()
);

comment on table public.realized_sales is
  'ITS-137: one row per sold offer item, with the seller''s cost basis at the time of sale. '
  'Seller-only. Realized gain = (sale_price_cents - cost_basis_cents) x quantity.';

create index if not exists realized_sales_seller_idx on public.realized_sales (seller_id, realized_at desc);

alter table public.realized_sales enable row level security;

drop policy if exists realized_sales_seller_read on public.realized_sales;
create policy realized_sales_seller_read
  on public.realized_sales
  for select
  to authenticated
  using (seller_id = (select auth.uid()));

revoke all on public.realized_sales from anon, authenticated;
grant select on public.realized_sales to authenticated;

-- ── 4. Root of a listing chain ──────────────────────────────────────────────

create or replace function public._item_root(p_item_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_item_id;
  v_up uuid;
  i integer := 0;
begin
  loop
    select mirror_of into v_up from public.collection_items where id = v_id;
    if not found then
      return null;
    end if;
    exit when v_up is null or i >= 5;
    v_id := v_up;
    i := i + 1;
  end loop;
  return v_id;
end;
$$;

revoke all on function public._item_root(uuid) from public, anon, authenticated;

-- ── 5. Mirrors carry the serial number ──────────────────────────────────────
-- Same as 20261128000000_its134_list_for_sale.sql, plus serial_number.

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
    grading_company, variants, grade_condition_id, asking_price_cents, asking_currency,
    serial_number
  )
  values (
    v_target, p_src.collection_id, p_src.id, p_src.user_id, p_src.item_kind, p_src.ref_id,
    p_src.quantity, 0, p_src.grading_company, p_src.variants, p_src.grade_condition_id,
    p_src.asking_price_cents, p_src.asking_currency, p_src.serial_number
  );
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
           asking_currency = new.asking_currency, serial_number = new.serial_number,
           updated_at = now()
     where m.mirror_of = new.id
       and (m.item_kind, m.ref_id, m.quantity, m.grade_condition_id, m.grading_company,
            coalesce(m.variants, '{}'), m.asking_price_cents, m.asking_currency, m.serial_number)
           is distinct from
           (new.item_kind, new.ref_id, new.quantity, new.grade_condition_id, new.grading_company,
            coalesce(new.variants, '{}'), new.asking_price_cents, new.asking_currency, new.serial_number);
  end if;

  -- An edit made on a mirror (e.g. quantity in the Selling tab) goes back to its source.
  if new.mirror_of is not null then
    update public.collection_items s
       set item_kind = new.item_kind, ref_id = new.ref_id, quantity = new.quantity,
           grade_condition_id = new.grade_condition_id, grading_company = new.grading_company,
           variants = new.variants, asking_price_cents = new.asking_price_cents,
           asking_currency = new.asking_currency, serial_number = new.serial_number,
           updated_at = now()
     where s.id = new.mirror_of
       and (s.item_kind, s.ref_id, s.quantity, s.grade_condition_id, s.grading_company,
            coalesce(s.variants, '{}'), s.asking_price_cents, s.asking_currency, s.serial_number)
           is distinct from
           (new.item_kind, new.ref_id, new.quantity, new.grade_condition_id, new.grading_company,
            coalesce(new.variants, '{}'), new.asking_price_cents, new.asking_currency, new.serial_number);
  end if;

  return new;
end;
$$;

drop trigger if exists collection_items_mirror_update on public.collection_items;
create trigger collection_items_mirror_update
  after update of collection_id, item_kind, ref_id, quantity, grade_condition_id, grading_company,
                  variants, asking_price_cents, asking_currency, serial_number
  on public.collection_items
  for each row execute function public._mirror_on_update();

-- ── 6. List for Sale / Remove from sale keep the attributes ─────────────────

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
    variants, asking_price_cents, serial_number
  )
  values (
    v_target, v_uid, v_pc.item_kind, v_pc.ref_id, p_quantity, v_pc.grade_condition_id,
    v_pc.grading_company, coalesce(v_pc.variants, '{}'), p_asking_price_cents, v_pc.serial_number
  )
  returning * into v_listing;

  -- The copies' photos and private attributes go with them.
  insert into public.collection_item_images (
    collection_item_id, user_id, image_cache_id, storage_path, width, height, position, is_primary
  )
  select v_listing.id, v_uid, img.image_cache_id, img.storage_path, img.width, img.height,
         img.position, img.is_primary
    from public.collection_item_images img
   where img.collection_item_id = v_pc.id;

  insert into public.collection_item_private (collection_item_id, user_id, cost_basis_cents, condition_notes)
  select v_listing.id, v_uid, p.cost_basis_cents, p.condition_notes
    from public.collection_item_private p
   where p.collection_item_id = v_pc.id;

  if v_pc.quantity = p_quantity then
    delete from public.collection_items where id = v_pc.id;
  else
    update public.collection_items set quantity = quantity - p_quantity where id = v_pc.id;
  end if;

  return v_listing;
end;
$$;

-- Copies go back into a PC row only when nothing tells them apart: same card, grade and
-- variants, no serial number, and the same cost basis and notes. Otherwise they get a PC row
-- of their own, so no cost is averaged away.
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
  v_cost integer;
  v_notes text;
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

  select p.cost_basis_cents, p.condition_notes into v_cost, v_notes
    from public.collection_item_private p
   where p.collection_item_id = v_listing.id;

  perform public.ensure_default_collections_for_user(v_uid);
  select id into v_vault from public.collections where user_id = v_uid and coalesce(is_vault, false)
   order by created_at limit 1;

  if v_listing.serial_number is null then
    select p.* into v_pc
      from public.collection_items p
     where p.collection_id = v_vault and p.mirror_of is null
       and p.item_kind = v_listing.item_kind and p.ref_id = v_listing.ref_id
       and p.grade_condition_id is not distinct from v_listing.grade_condition_id
       and p.grading_company is not distinct from v_listing.grading_company
       and coalesce(p.variants, '{}') = coalesce(v_listing.variants, '{}')
       and p.serial_number is null
       and (select x.cost_basis_cents from public.collection_item_private x
             where x.collection_item_id = p.id) is not distinct from v_cost
       and (select x.condition_notes from public.collection_item_private x
             where x.collection_item_id = p.id) is not distinct from v_notes
     order by p.created_at
     limit 1
     for update;
  end if;

  if v_pc.id is not null then
    update public.collection_items set quantity = quantity + v_listing.quantity
     where id = v_pc.id
    returning * into v_pc;
  else
    insert into public.collection_items (
      collection_id, user_id, item_kind, ref_id, quantity, grade_condition_id, grading_company,
      variants, serial_number
    )
    values (
      v_vault, v_uid, v_listing.item_kind, v_listing.ref_id, v_listing.quantity,
      v_listing.grade_condition_id, v_listing.grading_company, coalesce(v_listing.variants, '{}'),
      v_listing.serial_number
    )
    returning * into v_pc;

    insert into public.collection_item_images (
      collection_item_id, user_id, image_cache_id, storage_path, width, height, position, is_primary
    )
    select v_pc.id, v_uid, img.image_cache_id, img.storage_path, img.width, img.height,
           img.position, img.is_primary
      from public.collection_item_images img
     where img.collection_item_id = v_listing.id;

    if v_cost is not null or v_notes is not null then
      insert into public.collection_item_private (collection_item_id, user_id, cost_basis_cents, condition_notes)
      values (v_pc.id, v_uid, v_cost, v_notes);
    end if;
  end if;

  delete from public.collection_items where id = v_listing.id;
  return v_pc;
end;
$$;

-- ── 7. Transfer: buyer's cost basis, seller's realized gain ─────────────────
-- Same as 20261128000000_its134_list_for_sale.sql, plus the serial number, the buyer's cost
-- basis (price paid per copy) and a realized_sales row for the seller.

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
  v_price_cents integer;
  v_seller_cost integer;
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
    v_seller_cost := null;
    v_price_cents := greatest(0, round(coalesce(v_item.offered_price_per_unit, 0) * 100))::integer;

    if v_item.collection_item_id is not null then
      select * into v_listing from public.collection_items where id = v_item.collection_item_id for update;
    end if;
    if v_listing.id is not null then
      select id into v_selling_row from public.collection_items where mirror_of = v_listing.id limit 1;
      if v_selling_row is not null then
        select id into v_vault_row from public.collection_items where mirror_of = v_selling_row limit 1;
      end if;
      select p.cost_basis_cents into v_seller_cost
        from public.collection_item_private p
       where p.collection_item_id = public._item_root(v_listing.id);
    end if;

    v_ref := coalesce(v_listing.ref_id, nullif(v_item.card_snapshot ->> 'card_id', '')::uuid);

    if v_ref is not null and v_buyer_vault is not null then
      insert into public.collection_items (
        collection_id, user_id, item_kind, ref_id, quantity,
        grade_condition_id, grading_company, variants, source_offer_item_id, serial_number
      )
      values (
        v_buyer_vault, v_offer.buyer_id, coalesce(v_listing.item_kind, 'card'::public.item_kind), v_ref, v_item.quantity,
        v_listing.grade_condition_id, v_listing.grading_company, coalesce(v_listing.variants, '{}'), v_item.id,
        case when v_item.quantity = 1 then v_listing.serial_number end
      )
      on conflict (source_offer_item_id) do nothing
      returning id into v_new_id;

      if v_new_id is not null then
        -- What the buyer paid per copy is their cost basis.
        insert into public.collection_item_private (collection_item_id, user_id, cost_basis_cents)
        values (v_new_id, v_offer.buyer_id, v_price_cents)
        on conflict (collection_item_id) do nothing;
      end if;

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

    -- The seller's realized gain, with the cost basis as it stood at the sale.
    insert into public.realized_sales (
      seller_id, transaction_id, offer_item_id, item_kind, ref_id, grade_condition_id,
      grading_company, quantity, sale_price_cents, cost_basis_cents
    )
    values (
      v_offer.seller_id, v_tx.id, v_item.id, coalesce(v_listing.item_kind, 'card'::public.item_kind), v_ref,
      v_listing.grade_condition_id, v_listing.grading_company, v_item.quantity, v_price_cents, v_seller_cost
    )
    on conflict (offer_item_id) do nothing;

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

-- ── 8. Reading and editing an item's details ────────────────────────────────

-- One row (or any mirror of it): its attributes, market value per copy and unrealized gain.
create or replace function public.item_details(p_item_id uuid)
returns table (
  item_id uuid,
  root_id uuid,
  quantity integer,
  serial_number text,
  cost_basis_cents integer,
  condition_notes text,
  market_value_cents integer,
  unrealized_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.collection_items;
  v_root uuid;
begin
  select * into v_row from public.collection_items where id = p_item_id and user_id = auth.uid();
  if not found then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;
  v_root := public._item_root(v_row.id);

  return query
  select v_row.id, v_root, v_row.quantity, v_row.serial_number, p.cost_basis_cents, p.condition_notes,
         public._collection_item_value_cents(v_row.item_kind, v_row.ref_id, v_row.grade_condition_id, 1),
         case when p.cost_basis_cents is null then null
              else public._collection_item_value_cents(v_row.item_kind, v_row.ref_id, v_row.grade_condition_id, v_row.quantity)::bigint
                   - p.cost_basis_cents::bigint * v_row.quantity
         end
    from (select 1) one
    left join public.collection_item_private p on p.collection_item_id = v_root;
end;
$$;

-- Replaces the item's details (null clears a field). Works from the row or any of its mirrors;
-- the change is stored on the chain's root and the serial number is copied to the mirrors.
create or replace function public.set_item_details(
  p_item_id uuid,
  p_cost_basis_cents integer,
  p_serial_number text,
  p_condition_notes text
)
returns table (
  item_id uuid,
  root_id uuid,
  quantity integer,
  serial_number text,
  cost_basis_cents integer,
  condition_notes text,
  market_value_cents integer,
  unrealized_cents bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_root public.collection_items;
  v_serial text := nullif(btrim(coalesce(p_serial_number, '')), '');
  v_notes text := nullif(btrim(coalesce(p_condition_notes, '')), '');
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.collection_items where id = p_item_id and user_id = v_uid) then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  select * into v_root from public.collection_items
   where id = public._item_root(p_item_id) and user_id = v_uid
   for update;

  if p_cost_basis_cents is not null and p_cost_basis_cents < 0 then
    raise exception 'Cost can''t be negative' using errcode = '22023';
  end if;
  if v_serial is not null and v_root.quantity > 1 then
    raise exception 'A serial number belongs to one copy; this row holds %', v_root.quantity
      using errcode = '22023';
  end if;
  if v_serial is not null and char_length(v_serial) > 32 then
    raise exception 'Serial numbers are at most 32 characters' using errcode = '22023';
  end if;
  if v_notes is not null and char_length(v_notes) > 1000 then
    raise exception 'Notes are at most 1000 characters' using errcode = '22023';
  end if;

  if v_root.serial_number is distinct from v_serial then
    update public.collection_items set serial_number = v_serial where id = v_root.id;
  end if;

  if p_cost_basis_cents is null and v_notes is null then
    delete from public.collection_item_private where collection_item_id = v_root.id;
  else
    insert into public.collection_item_private (collection_item_id, user_id, cost_basis_cents, condition_notes, updated_at)
    values (v_root.id, v_uid, p_cost_basis_cents, v_notes, now())
    on conflict (collection_item_id) do update
      set cost_basis_cents = excluded.cost_basis_cents,
          condition_notes  = excluded.condition_notes,
          updated_at       = excluded.updated_at;
  end if;

  return query select * from public.item_details(p_item_id);
end;
$$;

-- ── 9. Portfolio gain ───────────────────────────────────────────────────────

-- Unrealized gain over the caller's Vault (what they own) for the copies with a cost, plus
-- realized gain from their recorded sales.
create or replace function public.portfolio_gain()
returns table (
  unrealized_cents bigint,
  cost_cents bigint,
  with_cost_quantity integer,
  without_cost_quantity integer,
  realized_cents bigint,
  realized_quantity integer,
  realized_without_cost_quantity integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with owned as (
    select ci.quantity,
           public._collection_item_value_cents(ci.item_kind, ci.ref_id, ci.grade_condition_id, ci.quantity)::bigint as value_cents,
           p.cost_basis_cents
      from public.collection_items ci
      join public.collections c on c.id = ci.collection_id and coalesce(c.is_vault, false)
      left join public.collection_item_private p on p.collection_item_id = public._item_root(ci.id)
     where ci.user_id = auth.uid() and ci.quantity > 0
  ),
  sold as (
    select quantity, sale_price_cents, cost_basis_cents
      from public.realized_sales
     where seller_id = auth.uid()
  )
  select
    (select coalesce(sum(value_cents - cost_basis_cents::bigint * quantity), 0) from owned where cost_basis_cents is not null)::bigint,
    (select coalesce(sum(cost_basis_cents::bigint * quantity), 0) from owned where cost_basis_cents is not null)::bigint,
    (select coalesce(sum(quantity), 0) from owned where cost_basis_cents is not null)::integer,
    (select coalesce(sum(quantity), 0) from owned where cost_basis_cents is null)::integer,
    (select coalesce(sum((sale_price_cents - cost_basis_cents)::bigint * quantity), 0) from sold where cost_basis_cents is not null)::bigint,
    (select coalesce(sum(quantity), 0) from sold where cost_basis_cents is not null)::integer,
    (select coalesce(sum(quantity), 0) from sold where cost_basis_cents is null)::integer;
$$;

revoke all on function public.item_details(uuid) from public, anon;
revoke all on function public.set_item_details(uuid, integer, text, text) from public, anon;
revoke all on function public.portfolio_gain() from public, anon;
grant execute on function public.item_details(uuid) to authenticated;
grant execute on function public.set_item_details(uuid, integer, text, text) to authenticated;
grant execute on function public.portfolio_gain() to authenticated;
