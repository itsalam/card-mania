-- Create enriched view for wishlist cards
create
or replace view public .wishlist_cards_enriched as
select
  w.user_id,
  w.created_at,
  c.*
from
  public .wishlist w
  join public .cards c on c .id = w.ref_id
where
  w.kind = 'card';

-- Add metadata + per-row computed cost
alter table
  public .wishlist
add
  column metadata jsonb not null default '{}' :: jsonb;

--add column item_cost_cents int not null default 0;
-- Total cache (fast reads)
create table public .wishlist_totals (
  user_id uuid primary key references auth.users(id) on
  delete
    cascade,
    total_cents int not null default 0,
    computed_at timestamptz not null default now()
);

-- RLS (optional but nice)
alter table
  public .wishlist_totals enable row level security;

create policy "read own total" on public .wishlist_totals for
select
  to authenticated using (user_id = auth.uid());

-- Trigger functions + triggers ------------------------
-- Simple helpers to compute item cost based on kind + ref_id + metadata
create
or replace function public ._wishlist_row_cost_cents(
  p_kind text,
  p_ref_id uuid,
  p_metadata jsonb
) returns int language sql stable as $$ -- For 'card', sum the selected grades; missing/null = 0
select
  case
    when p_kind = 'card' then (
      select
        coalesce(
          sum(
            coalesce((c .grades_prices ->> g) :: int, 0)
          ),
          0
        )
      from
        public .cards c,
        lateral (
          select
            jsonb_array_elements_text(coalesce(p_metadata -> 'grades', '[]' :: jsonb)) as g
        ) sel
      where
        c .id = p_ref_id
    )
    else 0
  end $$;

-- Trigger to update wishlist_totals on wishlist changes
create
or replace function public ._wishlist_totals_bump_on_wishlist() returns trigger language plpgsql as $$
declare
  v_user uuid;

v_before int := 0;

v_after int := 0;

v_delta int := 0;

begin
  if TG_OP = 'INSERT' then v_user := NEW .user_id;

v_after := public ._wishlist_row_cost_cents(NEW .kind, NEW .ref_id, NEW .metadata);

elsif TG_OP = 'DELETE' then v_user := OLD .user_id;

v_before := public ._wishlist_row_cost_cents(OLD .kind, OLD .ref_id, OLD .metadata);

else -- UPDATE
v_user := NEW .user_id;

v_before := public ._wishlist_row_cost_cents(OLD .kind, OLD .ref_id, OLD .metadata);

v_after := public ._wishlist_row_cost_cents(NEW .kind, NEW .ref_id, NEW .metadata);

end if;

v_delta := v_after - v_before;

if v_delta <> 0 then
insert into
  public .wishlist_totals(user_id, total_cents, computed_at)
values
  (v_user, v_delta, now()) on conflict (user_id) do
update
set
  total_cents = public .wishlist_totals.total_cents + excluded.total_cents,
  computed_at = excluded.computed_at;

end if;

if TG_OP = 'DELETE' then return OLD;

else return NEW;

end if;

end;

$$;

drop trigger if exists wishlist_totals_bump_aiud on public .wishlist;

create trigger wishlist_totals_bump_aiud after
insert
  or
update
  of kind,
  ref_id,
  metadata
  or
delete
  on public .wishlist for each row execute function public ._wishlist_totals_bump_on_wishlist();

-- Trigger updates on card price changes
create
or replace function public ._wishlist_totals_bump_on_card_prices() returns trigger language plpgsql as $$ begin
  -- Only react when grades_prices changes
  if TG_OP = 'UPDATE'
  and (
    NEW .grades_prices is distinct
    from
      OLD .grades_prices
  ) then -- For this one card, compute per-user delta and bump totals.
  -- Delta for a row = sum( NEW[g] - OLD[g] ) over selected grades.
  update
    public .wishlist_totals t
  set
    total_cents = t.total_cents + sub.delta_cents,
    computed_at = now()
  from
    (
      select
        w.user_id,
        coalesce(
          sum(
            coalesce((NEW .grades_prices ->> g) :: int, 0) - coalesce((OLD .grades_prices ->> g) :: int, 0)
          ),
          0
        ) as delta_cents
      from
        public .wishlist w,
        lateral jsonb_array_elements_text(coalesce(w.metadata -> 'grades', '[]' :: jsonb)) g
      where
        w.kind = 'card'
        and w.ref_id = NEW .id
      group by
        w.user_id
      having
        coalesce(
          sum(
            coalesce((NEW .grades_prices ->> g) :: int, 0) - coalesce((OLD .grades_prices ->> g) :: int, 0)
          ),
          0
        ) <> 0
    ) sub
  where
    t.user_id = sub.user_id;

-- Also create rows for users who didn’t have a totals row yet
insert into
  public .wishlist_totals(user_id, total_cents, computed_at)
select
  sub.user_id,
  sub.delta_cents,
  now()
from
  (
    select
      w.user_id,
      coalesce(
        sum(
          coalesce((NEW .grades_prices ->> g) :: int, 0) - coalesce((OLD .grades_prices ->> g) :: int, 0)
        ),
        0
      ) as delta_cents
    from
      public .wishlist w,
      lateral jsonb_array_elements_text(coalesce(w.metadata -> 'grades', '[]' :: jsonb)) g
    where
      w.kind = 'card'
      and w.ref_id = NEW .id
    group by
      w.user_id
    having
      coalesce(
        sum(
          coalesce((NEW .grades_prices ->> g) :: int, 0) - coalesce((OLD .grades_prices ->> g) :: int, 0)
        ),
        0
      ) <> 0
  ) sub on conflict (user_id) do nothing;

end if;

return NEW;

end;

$$;

drop trigger if exists wishlist_totals_bump_card_prices_au on public .cards;

create trigger wishlist_totals_bump_card_prices_au after
update
  of grades_prices on public .cards for each row execute function public ._wishlist_totals_bump_on_card_prices();

-- User functions ------------------------
-- simple compute
create
or replace function public .wishlist_total() returns int language sql stable as $$
select
  coalesce(
    (
      select
        total_cents
      from
        public .wishlist_totals
      where
        user_id = auth.uid()
    ),
    0
  );

$$;

grant execute on function public .wishlist_total() to authenticated;

-- Force recompute (slow)
create
or replace function public .wishlist_recompute_total() returns int language sql security definer
set
  search_path = public as $$ with rows as (
    select
      w.user_id,
      public ._wishlist_row_cost_cents(w.kind, w.ref_id, w.metadata) as row_cost
    from
      public .wishlist w
    where
      w.user_id = auth.uid()
  ),
  total as (
    select
      coalesce(sum(row_cost), 0) :: int as t
    from
      rows
  ),
  up as (
    insert into
      public .wishlist_totals(user_id, total_cents, computed_at)
    select
      auth.uid(),
      t,
      now()
    from
      total on conflict (user_id) do
    update
    set
      total_cents = excluded.total_cents,
      computed_at = excluded.computed_at returning total_cents
  )
select
  total_cents
from
  up;

$$;

grant execute on function public .wishlist_recompute_total() to authenticated;