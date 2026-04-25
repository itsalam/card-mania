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

-- Seed history with the freshly recalculated totals for every collection.
insert into public.collection_value_history (collection_id, total_cents, quantity_total, snapshotted_at)
select ct.collection_id, ct.total_cents, coalesce(ct.quantity_total, 0), now()
from   public.collection_totals ct;
