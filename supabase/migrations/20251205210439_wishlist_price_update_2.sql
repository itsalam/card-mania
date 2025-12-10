-- Align wishlist total bumpers with collection-backed wishlist and grade-aware pricing

-- Drop existing functions/triggers to avoid duplicates/overloads
drop function if exists public._wishlist_totals_bump_on_wishlist cascade;
drop function if exists public._wishlist_totals_bump_on_card_prices cascade;
drop trigger if exists wishlist_totals_bump_aiud on public.collection_items;
drop trigger if exists wishlist_totals_bump_card_prices_au on public.cards;

-- Helper to compute a row's cost from grades_prices using grade_condition + grading company
create or replace function public._wishlist_row_cost_cents_from_collection_item(
  p_item_kind public.item_kind,
  p_ref_id uuid,
  p_grade_condition_id uuid,
  p_grading_company text
) returns int
language sql
stable
as $$
  -- Only card rows carry price; others are 0
  select case
    when p_item_kind = 'card'::public.item_kind then (
      select coalesce(
        (c.grades_prices->>coalesce(gc.slug || gcnd.grade_value::text, 'ungraded'))::int,
        0
      )
      from public.cards c
      left join public.grade_conditions gcnd on gcnd.id = p_grade_condition_id
      left join public.grading_companies gc on gc.id = gcnd.company_id
      where c.id = p_ref_id
    )
    else 0
  end;
$$;

-- Trigger to update totals on collection_item changes (wishlist collections only)
create or replace function public._wishlist_totals_bump_on_wishlist()
returns trigger
language plpgsql
as $$
declare
  v_user uuid;
  v_before int := 0;
  v_after  int := 0;
  v_delta  int := 0;
begin
  -- only react for rows inside a wishlist collection
  if not exists (
    select 1
    from public.collections c
    where c.id = coalesce(NEW.collection_id, OLD.collection_id)
      and c.is_wishlist = true
  ) then
    if TG_OP = 'DELETE' then
      return OLD;
    else
      return NEW;
    end if;
  end if;

  if TG_OP = 'INSERT' then
    v_user  := NEW.user_id;
    v_after := public._wishlist_row_cost_cents_from_collection_item(
      NEW.item_kind,
      NEW.ref_id,
      NEW.grade_condition_id,
      NEW.grading_company
    ) * coalesce(NEW.quantity, 1);
  elsif TG_OP = 'DELETE' then
    v_user   := OLD.user_id;
    v_before := public._wishlist_row_cost_cents_from_collection_item(
      OLD.item_kind,
      OLD.ref_id,
      OLD.grade_condition_id,
      OLD.grading_company
    ) * coalesce(OLD.quantity, 1);
  else -- UPDATE
    v_user   := NEW.user_id;
    v_before := public._wishlist_row_cost_cents_from_collection_item(
      OLD.item_kind,
      OLD.ref_id,
      OLD.grade_condition_id,
      OLD.grading_company
    ) * coalesce(OLD.quantity, 1);
    v_after  := public._wishlist_row_cost_cents_from_collection_item(
      NEW.item_kind,
      NEW.ref_id,
      NEW.grade_condition_id,
      NEW.grading_company
    ) * coalesce(NEW.quantity, 1);
  end if;

  v_delta := v_after - v_before;

  if v_delta <> 0 then
    insert into public.wishlist_totals(user_id, total_cents, computed_at)
    values (v_user, v_delta, now())
    on conflict (user_id) do update
      set total_cents = public.wishlist_totals.total_cents + excluded.total_cents,
          computed_at = excluded.computed_at;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$;

-- Trigger to recompute totals on card price changes (grade-aware)
create or replace function public._wishlist_totals_bump_on_card_prices()
returns trigger
language plpgsql
as $$
begin
  -- Only react when grades_prices changes
  if TG_OP = 'UPDATE' and (NEW.grades_prices is distinct from OLD.grades_prices) then
    with wishlist_rows as (
      select
        ci.user_id,
        ci.quantity,
        coalesce(gc.slug || gcnd.grade_value::text, 'ungraded') as price_key
      from public.collection_items ci
      join public.collections c on c.id = ci.collection_id and c.is_wishlist = true
      left join public.grade_conditions gcnd on gcnd.id = ci.grade_condition_id
      left join public.grading_companies gc on gc.id = gcnd.company_id
      where ci.item_kind = 'card'::public.item_kind
        and ci.ref_id = NEW.id
    ),
    deltas as (
      select
        wr.user_id,
        sum(
          wr.quantity * (
            coalesce((NEW.grades_prices->>wr.price_key)::int, 0)
            - coalesce((OLD.grades_prices->>wr.price_key)::int, 0)
          )
        ) as delta_cents
      from wishlist_rows wr
      group by wr.user_id
      having sum(
        wr.quantity * (
          coalesce((NEW.grades_prices->>wr.price_key)::int, 0)
          - coalesce((OLD.grades_prices->>wr.price_key)::int, 0)
        )
      ) <> 0
    )
    insert into public.wishlist_totals (user_id, total_cents, computed_at)
    select d.user_id, d.delta_cents, now()
    from deltas d
    on conflict (user_id) do update
      set total_cents = public.wishlist_totals.total_cents + excluded.total_cents,
          computed_at = excluded.computed_at;
  end if;

  return NEW;
end;
$$;

-- Recreate triggers
create trigger wishlist_totals_bump_aiud
after insert or update or delete
on public.collection_items
for each row execute function public._wishlist_totals_bump_on_wishlist();

create trigger wishlist_totals_bump_card_prices_au
after update of grades_prices on public.cards
for each row execute function public._wishlist_totals_bump_on_card_prices();
