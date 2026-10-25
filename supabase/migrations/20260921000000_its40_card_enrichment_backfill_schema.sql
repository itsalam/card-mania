-- ITS-40: backfill lazy enrichment (eBay search cache + card image) for
-- cards rows that predate/missed the existing live enrichment path.

-- enriched_at marks a row as terminal (success OR confirmed no-match /
-- malformed-name — both are "nothing left to do" outcomes, so the backfill
-- job never spins on the same row forever). Left null on transient failures
-- (network/auth/rate-limit) so the row is retried on a later run.
-- enrichment_locked_at is a short lease so concurrent/overlapping backfill
-- invocations never claim the same row twice.
alter table public.cards
  add column if not exists enriched_at timestamptz null,
  add column if not exists enrichment_locked_at timestamptz null;

-- The backfill claim query only ever looks at un-enriched rows, ordered by
-- last_updated for a stable, roughly-oldest-first scan.
create index if not exists idx_cards_unenriched
  on public.cards (last_updated)
  where enriched_at is null;

-- Atomically leases a batch of un-enriched, unclaimed (or stale-claimed)
-- rows using FOR UPDATE SKIP LOCKED. A claimed row whose lease has expired
-- (p_lease_seconds) becomes reclaimable automatically, and two concurrent
-- invocations never grab the same row.
create or replace function public.claim_cards_for_backfill_enrichment(
  p_limit int,
  p_lease_seconds int default 600
) returns table (id uuid, name text, set_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.cards c
  set enrichment_locked_at = now()
  from (
    select cc.id
    from public.cards cc
    where cc.enriched_at is null
      and (cc.enrichment_locked_at is null
           or cc.enrichment_locked_at < now() - make_interval(secs => p_lease_seconds))
    order by cc.last_updated asc
    limit p_limit
    for update skip locked
  ) claimed
  where c.id = claimed.id
  returning c.id, c.name, c.set_name;
end;
$$;

grant execute on function public.claim_cards_for_backfill_enrichment(int, int) to service_role;

-- The BEFORE UPDATE trigger on cards previously bumped last_updated on
-- *every* update, regardless of which column changed. That's a regression
-- risk for this backfill job: claiming/marking thousands of rows would
-- otherwise reorder anything that sorts/filters by cards.last_updated
-- (it has its own index). Only bump last_updated when a real content column
-- changes; bookkeeping-only writes (enriched_at, enrichment_locked_at) are
-- excluded via a jsonb diff so this stays correct if columns are added later
-- without needing to update this function.
--
-- search_vector is also excluded: it's a GENERATED ALWAYS ... STORED column,
-- which reads as NULL on NEW inside a BEFORE trigger (not recomputed yet)
-- but has a real value on OLD — without excluding it, every update would
-- look "distinct" on that column alone and defeat this guard entirely.
create or replace function public.set_cards_last_updated()
returns trigger
language plpgsql
as $$
begin
  if (to_jsonb(new) - 'last_updated' - 'enriched_at' - 'enrichment_locked_at' - 'search_vector')
     is distinct from
     (to_jsonb(old) - 'last_updated' - 'enriched_at' - 'enrichment_locked_at' - 'search_vector')
  then
    new.last_updated := now();
  end if;
  return new;
end;
$$;
