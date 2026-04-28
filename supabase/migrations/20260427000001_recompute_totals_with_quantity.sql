-- Recompute collection_totals from scratch.
-- Previous totals may be stale because the client-side isEqualToInitial guard
-- was skipping DB writes when only quantity changed: the pre-patch draft equalled
-- initialDraft so the mutation was dropped, the DB quantity was never updated,
-- and the incremental trigger never fired.

insert into public.collection_totals (collection_id, total_cents, quantity_total, computed_at)
select
  ci.collection_id,
  coalesce(sum(public._collection_item_value_cents(
    ci.item_kind, ci.ref_id, ci.grade_condition_id, ci.quantity
  )), 0)                        as total_cents,
  coalesce(sum(ci.quantity), 0) as quantity_total,
  now()
from public.collection_items ci
where ci.quantity > 0
group by ci.collection_id
on conflict (collection_id) do update
  set total_cents    = excluded.total_cents,
      quantity_total = excluded.quantity_total,
      computed_at    = excluded.computed_at;

-- Reseed history with the freshly computed values.
insert into public.collection_value_history (collection_id, total_cents, quantity_total, snapshotted_at)
select ct.collection_id, ct.total_cents, coalesce(ct.quantity_total, 0), now()
from   public.collection_totals ct;
