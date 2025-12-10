-- Recompute wishlist totals on card price changes using collection_items grade metadata

-- Drop prior price bump function/trigger
drop function if exists public._wishlist_totals_bump_on_card_prices cascade;

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
    update public.wishlist_totals t
    set total_cents = t.total_cents + d.delta_cents,
        computed_at = now()
    from deltas d
    where t.user_id = d.user_id;

    -- Insert rows for users without totals yet
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

drop trigger if exists wishlist_totals_bump_card_prices_au on public.cards;
create trigger wishlist_totals_bump_card_prices_au
after update of grades_prices on public.cards
for each row execute function public._wishlist_totals_bump_on_card_prices();

-- Unify wishlist_toggle signature (grade_condition-aware)
drop function if exists public.wishlist_toggle(text, uuid);
drop function if exists public.wishlist_toggle(text, uuid, jsonb);
drop function if exists public.wishlist_toggle(text, uuid, uuid);

create or replace function public.wishlist_toggle(
  p_kind     text,
  p_ref_id   uuid,
  p_grade_cond_id uuid default null
) returns table(is_wishlisted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_collection_id uuid;
  v_grade_cond_id uuid := p_grade_cond_id;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Resolve wishlist collection for this user
  select w.collection_id
  into v_collection_id
  from public.wishlist w
  where w.user_id = v_user;

  if v_collection_id is null then
    raise exception 'Wishlist collection not found for user %', v_user;
  end if;

  -- Toggle off if exists (optionally scoped by grade_condition_id)
  delete from public.collection_items
  where collection_id = v_collection_id
    and user_id = v_user
    and item_kind = p_kind::public.item_kind
    and ref_id = p_ref_id
    and (v_grade_cond_id is null or grade_condition_id = v_grade_cond_id);

  if found then
    return query select false as is_wishlisted;
    return;
  end if;

  -- Insert new wishlist row
  insert into public.collection_items (
    collection_id,
    user_id,
    item_kind,
    ref_id,
    grade_condition_id,
    quantity,
    position
  ) values (
    v_collection_id,
    v_user,
    p_kind::public.item_kind,
    p_ref_id,
    v_grade_cond_id,
    1,
    0
  );

  return query select true as is_wishlisted;
end;
$$;

grant execute on function public.wishlist_toggle(text, uuid, uuid) to authenticated;
