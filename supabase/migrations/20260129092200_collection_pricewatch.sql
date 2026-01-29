-- Collection totals cache (mirrors wishlist_totals pattern)

create table if not exists public.collection_totals (
  collection_id uuid primary key references public.collections(id) on delete cascade,
  total_cents int not null default 0,
  computed_at timestamptz not null default now()
);

alter table public.collection_totals enable row level security;

-- Owners can read their own collection totals
create policy "collection_totals: read own"
  on public.collection_totals
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.collections c
      where c.id = collection_totals.collection_id
        and c.user_id = auth.uid()
    )
  );

-- Helper to compute a collection item's value in cents, respecting grade + quantity
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

-- Trigger: bump totals when collection_items change
create or replace function public._collection_totals_bump_on_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collection uuid;
  v_before int := 0;
  v_after int := 0;
  v_delta int := 0;
begin
  if TG_OP = 'INSERT' then
    v_collection := new.collection_id;
    v_after := public._collection_item_value_cents(new.item_kind, new.ref_id, new.grade_condition_id, new.quantity);
  elsif TG_OP = 'DELETE' then
    v_collection := old.collection_id;
    v_before := public._collection_item_value_cents(old.item_kind, old.ref_id, old.grade_condition_id, old.quantity);
  else
    v_collection := new.collection_id;
    v_before := public._collection_item_value_cents(old.item_kind, old.ref_id, old.grade_condition_id, old.quantity);
    v_after := public._collection_item_value_cents(new.item_kind, new.ref_id, new.grade_condition_id, new.quantity);
  end if;

  v_delta := v_after - v_before;

  if v_delta <> 0 then
    insert into public.collection_totals (collection_id, total_cents, computed_at)
    values (v_collection, v_delta, now())
    on conflict (collection_id) do update
      set total_cents = public.collection_totals.total_cents + excluded.total_cents,
          computed_at = excluded.computed_at;
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

-- Trigger: bump totals when underlying card prices change
create or replace function public._collection_totals_bump_on_card_prices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and (new.grades_prices is distinct from old.grades_prices) then
    -- per-collection delta based on quantity and price key
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
    insert into public.collection_totals (collection_id, total_cents, computed_at)
    select d.collection_id, d.delta_cents, now()
    from deltas d
    on conflict (collection_id) do update
      set total_cents = public.collection_totals.total_cents + excluded.total_cents,
          computed_at = excluded.computed_at;
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
