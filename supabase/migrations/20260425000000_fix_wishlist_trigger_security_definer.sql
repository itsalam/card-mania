-- Fix: _wishlist_totals_bump_on_wishlist was missing SECURITY DEFINER.
-- The trigger ran with the calling user's privileges but wishlist_totals has no
-- INSERT/UPDATE RLS policy for authenticated users, causing 42501 on item delete.

create or replace function public._wishlist_totals_bump_on_wishlist()
returns trigger
language plpgsql
security definer
set search_path = public
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
