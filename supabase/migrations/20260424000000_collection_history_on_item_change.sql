-- Snapshot collection_value_history on every item-level change
-- so the portfolio timeline chart reflects additions/removals in real time
-- rather than waiting for the nightly pg_cron snapshot.
--
-- Strategy:
--   After _collection_totals_bump_on_items() updates collection_totals it now
--   reads back the resulting total and writes one row to collection_value_history.
--   The daily pg_cron job continues to run as a safety net for collections whose
--   totals change only via card-price updates (no item changes that day).

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
  v_new_total    int;
  v_new_qty      int;
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
    -- Update the live total and capture the resulting row.
    insert into public.collection_totals (collection_id, total_cents, quantity_total, computed_at)
    values (v_collection, v_delta_value, v_delta_qty, now())
    on conflict (collection_id) do update
      set total_cents    = public.collection_totals.total_cents + excluded.total_cents,
          quantity_total = public.collection_totals.quantity_total + excluded.quantity_total,
          computed_at    = excluded.computed_at
    returning total_cents, quantity_total
      into v_new_total, v_new_qty;

    -- Append a history snapshot using the item's determined value at this moment.
    insert into public.collection_value_history
      (collection_id, total_cents, quantity_total, snapshotted_at)
    values
      (v_collection, v_new_total, v_new_qty, now());
  end if;

  if TG_OP = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Recompute collection_totals from scratch so the values displayed in the UI
-- reflect each item's current market price rather than any potentially stale
-- incremental delta that accumulated since the last full recalculation.
insert into public.collection_totals (collection_id, total_cents, quantity_total, computed_at)
select
  ci.collection_id,
  coalesce(sum(public._collection_item_value_cents(
    ci.item_kind, ci.ref_id, ci.grade_condition_id, ci.quantity
  )), 0) as total_cents,
  coalesce(sum(coalesce(ci.quantity, 1)), 0) as quantity_total,
  now()
from public.collection_items ci
group by ci.collection_id
on conflict (collection_id) do update
  set total_cents    = excluded.total_cents,
      quantity_total = excluded.quantity_total,
      computed_at    = excluded.computed_at;

-- Seed history with the freshly recalculated totals for every collection
-- (replaces the stale values that a delta-only backfill would have used).
insert into public.collection_value_history (collection_id, total_cents, quantity_total, snapshotted_at)
select ct.collection_id, ct.total_cents, coalesce(ct.quantity_total, 0), now()
from   public.collection_totals ct;
