-- ITS-133: one value snapshot per collection per transaction.
--
-- Every write to collection_totals appended a collection_value_history row stamped now(),
-- and so did the item trigger that bumps the totals. now() is the transaction's start
-- time, so one action that touches several rows (List for Sale, confirming a sale,
-- mirrors) left several rows with the same timestamp, including in-between states (a card
-- counted in the Vault both as the PC copy and as the new listing's mirror). History is
-- ordered by time only, so which tie came "last" was arbitrary: the Home chart and the
-- Cards stat could show a total the collection never settled on.
--
-- Now:
--   * (collection_id, snapshotted_at) is unique, and writers upsert, so the last statement
--     in a transaction overwrites the earlier ones and the row holds the settled value.
--   * Only the collection_totals trigger writes snapshots; the item trigger no longer
--     writes its own copy.
--   * Existing ties are collapsed (keeping the last row written), and each collection's
--     newest snapshot is set to its current total.

-- ── 1. Collapse existing ties ───────────────────────────────────────────────
-- Rows written in one transaction are appended in order, so the highest ctid in a tie is
-- the last one written.
delete from public.collection_value_history h
using (
  select ctid,
         row_number() over (partition by collection_id, snapshotted_at order by ctid desc) rn
  from public.collection_value_history
) d
where h.ctid = d.ctid
  and d.rn > 1;

-- The newest snapshot should match the live total; fix any that settled on a mid-
-- transaction value.
update public.collection_value_history h
set total_cents    = ct.total_cents,
    quantity_total = coalesce(ct.quantity_total, 0)
from public.collection_totals ct
where ct.collection_id = h.collection_id
  and h.snapshotted_at = (
    select max(h2.snapshotted_at)
    from public.collection_value_history h2
    where h2.collection_id = h.collection_id
  )
  and (h.total_cents, h.quantity_total) is distinct from (ct.total_cents, coalesce(ct.quantity_total, 0));

-- ── 2. One row per collection per timestamp ─────────────────────────────────
-- Replaces the plain (collection_id, snapshotted_at desc) index with a unique one.
create unique index collection_value_history_collection_time_key
  on public.collection_value_history (collection_id, snapshotted_at desc);
drop index if exists public.collection_value_history_collection_time;

-- ── 3. Writers upsert ───────────────────────────────────────────────────────
create or replace function public._snapshot_history_on_total_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.collection_value_history
    (collection_id, total_cents, quantity_total, snapshotted_at)
  values
    (new.collection_id, new.total_cents, coalesce(new.quantity_total, 0), now())
  on conflict (collection_id, snapshotted_at) do update
    set total_cents    = excluded.total_cents,
        quantity_total = excluded.quantity_total;
  return new;
end;
$$;

create or replace function public.trg_collection_init_totals()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.collection_totals (collection_id, total_cents, quantity_total, computed_at)
  values (new.id, 0, 0, now())
  on conflict (collection_id) do nothing;

  insert into public.collection_value_history (collection_id, total_cents, quantity_total, snapshotted_at)
  values (new.id, 0, 0, now())
  on conflict (collection_id, snapshotted_at) do nothing;

  return new;
end;
$$;

-- Same as before, minus its own history insert: the collection_totals update below fires
-- _snapshot_history_on_total_change, which records the snapshot.
create or replace function public._collection_totals_bump_on_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collection   uuid;
  v_before_value int := 0;
  v_after_value  int := 0;
  v_before_qty   int := 0;
  v_after_qty    int := 0;
  v_delta_value  int := 0;
  v_delta_qty    int := 0;
begin
  if TG_OP = 'INSERT' then
    v_collection  := new.collection_id;
    v_after_value := public._collection_item_value_cents(new.item_kind, new.ref_id, new.grade_condition_id, new.quantity);
    v_after_qty   := coalesce(new.quantity, 1);
  elsif TG_OP = 'DELETE' then
    v_collection   := old.collection_id;
    v_before_value := public._collection_item_value_cents(old.item_kind, old.ref_id, old.grade_condition_id, old.quantity);
    v_before_qty   := coalesce(old.quantity, 1);
  else -- UPDATE
    v_collection   := new.collection_id;
    v_before_value := public._collection_item_value_cents(old.item_kind, old.ref_id, old.grade_condition_id, old.quantity);
    v_after_value  := public._collection_item_value_cents(new.item_kind, new.ref_id, new.grade_condition_id, new.quantity);
    v_before_qty   := coalesce(old.quantity, 1);
    v_after_qty    := coalesce(new.quantity, 1);
  end if;

  v_delta_value := v_after_value - v_before_value;
  v_delta_qty   := v_after_qty  - v_before_qty;

  if v_delta_value <> 0 or v_delta_qty <> 0 then
    insert into public.collection_totals (collection_id, total_cents, quantity_total, computed_at)
    values (v_collection, v_delta_value, v_delta_qty, now())
    on conflict (collection_id) do update
      set total_cents    = public.collection_totals.total_cents + excluded.total_cents,
          quantity_total = public.collection_totals.quantity_total + excluded.quantity_total,
          computed_at    = excluded.computed_at;
  end if;

  if TG_OP = 'DELETE' then return old; else return new; end if;
end;
$$;

-- The nightly copy: same job, now an upsert (scheduling by an existing name replaces it).
select cron.schedule(
  'daily-portfolio-snapshot',
  '0 0 * * *',
  $$
  insert into public.collection_value_history (collection_id, total_cents, quantity_total, snapshotted_at)
  select collection_id, total_cents, coalesce(quantity_total, 0), now()
  from public.collection_totals
  on conflict (collection_id, snapshotted_at) do update
    set total_cents    = excluded.total_cents,
        quantity_total = excluded.quantity_total;
  $$
);
