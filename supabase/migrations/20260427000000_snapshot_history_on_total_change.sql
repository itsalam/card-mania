-- Whenever collection_totals is updated (by any item mutation trigger), write a
-- corresponding row into collection_value_history so that get_portfolio_history
-- reflects the current value immediately — not just after the nightly pg_cron run.
--
-- Without this, vault/selling totals updated today won't appear in the history
-- chart until midnight, causing a visible mismatch between the breakdown rings
-- (which read collection_totals directly) and the history chart.

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
    (new.collection_id,
     new.total_cents,
     coalesce(new.quantity_total, 0),
     now());
  return new;
end;
$$;

drop trigger if exists collection_value_history_on_total_change on public.collection_totals;

create trigger collection_value_history_on_total_change
after insert or update of total_cents, quantity_total
on public.collection_totals
for each row
execute function public._snapshot_history_on_total_change();

-- One-time backfill: seed a snapshot for every collection that currently has a
-- total row but no recent history entry (covers selling/vault created before
-- this trigger existed).
insert into public.collection_value_history
  (collection_id, total_cents, quantity_total, snapshotted_at)
select
  ct.collection_id,
  ct.total_cents,
  coalesce(ct.quantity_total, 0),
  now()
from public.collection_totals ct;
