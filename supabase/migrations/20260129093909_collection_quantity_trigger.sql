-- Extend collection_totals with quantity tracking and refresh triggers.

-- Add quantity_total column
alter table public.collection_totals
  add column if not exists quantity_total int not null default 0;

-- Helper reused: value in cents for a collection item (card-only for now)
create or replace function public._collection_item_value_cents(
  p_item_kind public.item_kind,
  p_ref_id uuid,
  p_grade_condition_id uuid,
  p_quantity int default 1
) returns int
language sql
stable
as $$
  with pk as (
    select coalesce(
      (
        select gc.slug || gcnd.grade_value::text
        from public.grade_conditions gcnd
        left join public.grading_companies gc on gc.id = gcnd.company_id
        where gcnd.id = p_grade_condition_id
      ),
      'ungraded'
    ) as key
  )
  select coalesce(
           (
             select coalesce((c.grades_prices ->> pk.key)::int, 0)
             from pk
             join public.cards c on c.id = p_ref_id
             where p_item_kind = 'card'::public.item_kind
             limit 1
           ),
           0
         ) * coalesce(p_quantity, 1);
$$;

-- Trigger: bump totals (price + quantity) on collection_items changes
create or replace function public._collection_totals_bump_on_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collection uuid;
  v_before_value int := 0;
  v_after_value int := 0;
  v_before_qty int := 0;
  v_after_qty int := 0;
  v_delta_value int := 0;
  v_delta_qty int := 0;
begin
  if TG_OP = 'INSERT' then
    v_collection := new.collection_id;
    v_after_value := public._collection_item_value_cents(new.item_kind, new.ref_id, new.grade_condition_id, new.quantity);
    v_after_qty := coalesce(new.quantity, 1);
  elsif TG_OP = 'DELETE' then
    v_collection := old.collection_id;
    v_before_value := public._collection_item_value_cents(old.item_kind, old.ref_id, old.grade_condition_id, old.quantity);
    v_before_qty := coalesce(old.quantity, 1);
  else
    v_collection := new.collection_id;
    v_before_value := public._collection_item_value_cents(old.item_kind, old.ref_id, old.grade_condition_id, old.quantity);
    v_after_value := public._collection_item_value_cents(new.item_kind, new.ref_id, new.grade_condition_id, new.quantity);
    v_before_qty := coalesce(old.quantity, 1);
    v_after_qty := coalesce(new.quantity, 1);
  end if;

  v_delta_value := v_after_value - v_before_value;
  v_delta_qty := v_after_qty - v_before_qty;

  if v_delta_value <> 0 or v_delta_qty <> 0 then
    insert into public.collection_totals (collection_id, total_cents, quantity_total, computed_at)
    values (v_collection, v_delta_value, v_delta_qty, now())
    on conflict (collection_id) do update
      set total_cents    = public.collection_totals.total_cents + excluded.total_cents,
          quantity_total = public.collection_totals.quantity_total + excluded.quantity_total,
          computed_at    = excluded.computed_at;
  end if;

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

drop trigger if exists collection_totals_bump_aiud on public.collection_items;

create trigger collection_totals_bump_aiud
after insert or update of item_kind, ref_id, grade_condition_id, quantity or delete
on public.collection_items
for each row
execute function public._collection_totals_bump_on_items();

-- Trigger: bump totals when underlying card prices change (quantity unchanged)
create or replace function public._collection_totals_bump_on_card_prices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and (new.grades_prices is distinct from old.grades_prices) then
    with deltas as (
      select
        ci.collection_id,
        sum(
          coalesce((new.grades_prices ->> coalesce(gc.slug || gcnd.grade_value::text, 'ungraded'))::int, 0)
          - coalesce((old.grades_prices ->> coalesce(gc.slug || gcnd.grade_value::text, 'ungraded'))::int, 0)
        ) * coalesce(ci.quantity, 1) as delta_cents
      from public.collection_items ci
      left join public.grade_conditions gcnd on gcnd.id = ci.grade_condition_id
      left join public.grading_companies gc on gc.id = gcnd.company_id
      where ci.item_kind = 'card'::public.item_kind
        and ci.ref_id = new.id
      group by ci.collection_id
      having sum(
        coalesce((new.grades_prices ->> coalesce(gc.slug || gcnd.grade_value::text, 'ungraded'))::int, 0)
        - coalesce((old.grades_prices ->> coalesce(gc.slug || gcnd.grade_value::text, 'ungraded'))::int, 0)
      ) <> 0
    )
    insert into public.collection_totals (collection_id, total_cents, quantity_total, computed_at)
    select d.collection_id, d.delta_cents, 0, now()
    from deltas d
    on conflict (collection_id) do update
      set total_cents    = public.collection_totals.total_cents + excluded.total_cents,
          computed_at    = excluded.computed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists collection_totals_bump_card_prices_au on public.cards;

create trigger collection_totals_bump_card_prices_au
after update of grades_prices
on public.cards
for each row
execute function public._collection_totals_bump_on_card_prices();

-- Backfill totals for all existing collections
insert into public.collection_totals (collection_id, total_cents, quantity_total, computed_at)
select
  ci.collection_id,
  coalesce(sum(public._collection_item_value_cents(ci.item_kind, ci.ref_id, ci.grade_condition_id, ci.quantity)), 0) as total_cents,
  coalesce(sum(coalesce(ci.quantity, 1)), 0) as quantity_total,
  now()
from public.collection_items ci
group by ci.collection_id
on conflict (collection_id) do update
  set total_cents    = excluded.total_cents,
      quantity_total = excluded.quantity_total,
      computed_at    = excluded.computed_at;
