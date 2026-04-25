-- Price history groundwork
--
-- Implements:
--   1. card_price_history        — per-grade price snapshots written on every fetch-card refresh
--   2. collection_value_history  — daily portfolio value snapshots (Strategy 1 MVP)
--   3. collection_item_events    — holdings change log (groundwork for Strategy 4 swap-in)
--   4. get_portfolio_history RPC — stable query interface; currently reads snapshots,
--                                  can be rewired to reconstruct from card_price_history
--                                  × collection_item_events without changing the signature
--   5. pg_cron job               — daily snapshot of all collection_totals

-- ─── 1. card_price_history ────────────────────────────────────────────────────
create table if not exists public.card_price_history (
  id            uuid        primary key default gen_random_uuid(),
  card_id       uuid        not null references public.cards(id) on delete cascade,
  grade         text        not null,
  price_cents   int         not null,
  recorded_at   timestamptz not null default now(),
  -- Stored generated column so we can build a unique index without an expression.
  -- date_trunc / ::date are STABLE (timezone-aware) and cannot appear in index
  -- expressions; pinning to UTC makes the derivation deterministic.
  recorded_date date        not null generated always as
                              ((recorded_at at time zone 'UTC')::date) stored
);

create index if not exists card_price_history_card_grade_time
  on public.card_price_history (card_id, grade, recorded_at desc);

-- One row per card/grade/day — prevents duplicate rows whether written by
-- the ongoing fetch-card snapshot or the historical backfill.
create unique index if not exists card_price_history_card_grade_day_uniq
  on public.card_price_history (card_id, grade, recorded_date);

alter table public.card_price_history enable row level security;

-- Prices are not user-specific; any authenticated user may read history
create policy "card_price_history: read all"
  on public.card_price_history for select
  using (true);

-- Service role (edge functions) writes history rows
create policy "card_price_history: service write"
  on public.card_price_history for insert
  to service_role
  with check (true);

-- ─── 2. collection_value_history ──────────────────────────────────────────────
create table if not exists public.collection_value_history (
  id             uuid        primary key default gen_random_uuid(),
  collection_id  uuid        not null references public.collections(id) on delete cascade,
  total_cents    int         not null,
  quantity_total int         not null default 0,
  snapshotted_at timestamptz not null default now()
);

create index if not exists collection_value_history_collection_time
  on public.collection_value_history (collection_id, snapshotted_at desc);

alter table public.collection_value_history enable row level security;

create policy "collection_value_history: read own"
  on public.collection_value_history for select
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_value_history.collection_id
        and c.user_id = auth.uid()
    )
  );

-- ─── 3. collection_item_events ────────────────────────────────────────────────
-- Append-only log of every holdings change. Not consumed by the current snapshot
-- strategy but accumulates data so that holdings-aware reconstruction (Strategy 4)
-- can be wired in without any backfill required.
create table if not exists public.collection_item_events (
  id                 uuid        primary key default gen_random_uuid(),
  collection_id      uuid        not null,
  ref_id             uuid        not null,
  grade_condition_id uuid,
  quantity_delta     int         not null,
  occurred_at        timestamptz not null default now()
);

create index if not exists collection_item_events_collection_time
  on public.collection_item_events (collection_id, occurred_at desc);

alter table public.collection_item_events enable row level security;

create policy "collection_item_events: read own"
  on public.collection_item_events for select
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_item_events.collection_id
        and c.user_id = auth.uid()
    )
  );

-- ─── 4. Trigger: record collection item events ────────────────────────────────
create or replace function public._record_collection_item_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.collection_item_events
      (collection_id, ref_id, grade_condition_id, quantity_delta)
    values
      (new.collection_id, new.ref_id, new.grade_condition_id, new.quantity);

  elsif TG_OP = 'DELETE' then
    insert into public.collection_item_events
      (collection_id, ref_id, grade_condition_id, quantity_delta)
    values
      (old.collection_id, old.ref_id, old.grade_condition_id, -old.quantity);

  else -- UPDATE: only log when something material changes
    if new.quantity is distinct from old.quantity
       or new.ref_id is distinct from old.ref_id
       or new.grade_condition_id is distinct from old.grade_condition_id then
      -- Remove old position
      insert into public.collection_item_events
        (collection_id, ref_id, grade_condition_id, quantity_delta)
      values
        (old.collection_id, old.ref_id, old.grade_condition_id, -old.quantity);
      -- Add new position
      insert into public.collection_item_events
        (collection_id, ref_id, grade_condition_id, quantity_delta)
      values
        (new.collection_id, new.ref_id, new.grade_condition_id, new.quantity);
    end if;
  end if;

  if TG_OP = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists collection_item_events_aiud on public.collection_items;

create trigger collection_item_events_aiud
after insert or update of quantity, ref_id, grade_condition_id or delete
on public.collection_items
for each row
execute function public._record_collection_item_event();

-- ─── 5. RPC: get_portfolio_history ────────────────────────────────────────────
-- Stable public interface for portfolio value over time.
--
-- CURRENT IMPLEMENTATION: reads pre-computed daily snapshots from
-- collection_value_history (Strategy 1 — simple, no write amplification).
--
-- FUTURE SWAP: to switch to holdings-aware reconstruction (Strategy 3/4),
-- replace the function body to join card_price_history against
-- collection_item_events at each time point — the signature stays identical
-- so all callers continue to work unchanged.
create or replace function public.get_portfolio_history(
  p_collection_id uuid,
  p_from          timestamptz default now() - interval '90 days',
  p_to            timestamptz default now()
)
returns table (
  snapshotted_at timestamptz,
  total_cents    int,
  quantity_total int
)
language sql
stable
security definer
set search_path = public
as $$
  select snapshotted_at, total_cents, quantity_total
  from public.collection_value_history
  where collection_id = p_collection_id
    and snapshotted_at between p_from and p_to
  order by snapshotted_at asc;
$$;

grant execute on function public.get_portfolio_history(uuid, timestamptz, timestamptz)
  to authenticated;

-- ─── 6. pg_cron: daily portfolio snapshot at 00:00 UTC ────────────────────────
-- Copies current collection_totals into collection_value_history once per day.
-- No edge function needed — all data already lives in the DB.
select cron.schedule(
  'daily-portfolio-snapshot',
  '0 0 * * *',
  $$
  insert into public.collection_value_history (collection_id, total_cents, quantity_total, snapshotted_at)
  select collection_id, total_cents, coalesce(quantity_total, 0), now()
  from public.collection_totals;
  $$
);
