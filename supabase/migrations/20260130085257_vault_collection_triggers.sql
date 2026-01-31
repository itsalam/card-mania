-- Sync items from a user's selling collection into their vault collection
-- Handles inserts, updates, deletes, and performs an initial backfill.

-- Trigger function: when a selling item is created, mirror it into vault
create or replace function public.sync_selling_item_to_vault()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_selling boolean := false;
  vault_collection_id uuid;
begin
  select coalesce(c.is_selling, false)
    into is_selling
  from public.collections c
  where c.id = new.collection_id
  limit 1;

  if not is_selling then
    return new;
  end if;

  select id
    into vault_collection_id
  from public.collections
  where user_id = new.user_id
    and coalesce(is_vault, false) = true
  limit 1;

  if vault_collection_id is null then
    return new;
  end if;

  -- avoid duplicates for the same item/grade/variants
  if exists (
    select 1
    from public.collection_items ci
    where ci.collection_id = vault_collection_id
      and ci.item_kind = new.item_kind
      and ci.ref_id = new.ref_id
      and coalesce(ci.grade_condition_id::text, '') = coalesce(new.grade_condition_id::text, '')
      and coalesce(ci.grading_company, '') = coalesce(new.grading_company, '')
      and coalesce(ci.variants, '{}'::text[]) = coalesce(new.variants, '{}'::text[])
  ) then
    return new;
  end if;

  insert into public.collection_items (
    id,
    collection_id,
    collection_ref,
    user_id,
    item_kind,
    ref_id,
    quantity,
    position,
    grading_company,
    variants,
    created_at,
    updated_at,
    grade_condition_id
  )
  values (
    gen_random_uuid(),
    vault_collection_id,
    new.collection_id,
    new.user_id,
    new.item_kind,
    new.ref_id,
    new.quantity,
    0,
    new.grading_company,
    new.variants,
    now(),
    now(),
    new.grade_condition_id
  );

  return new;
end;
$$;

drop trigger if exists trg_selling_items_to_vault on public.collection_items;
create trigger trg_selling_items_to_vault
after insert on public.collection_items
for each row execute function public.sync_selling_item_to_vault();

-- Trigger function: when a selling item is updated, mirror changes into vault
create or replace function public.sync_selling_item_update_to_vault()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_selling boolean := false;
  vault_collection_id uuid;
begin
  select coalesce(c.is_selling, false)
    into is_selling
  from public.collections c
  where c.id = new.collection_id
  limit 1;

  if not is_selling then
    return new;
  end if;

  select id
    into vault_collection_id
  from public.collections
  where user_id = new.user_id
    and coalesce(is_vault, false) = true
  limit 1;

  if vault_collection_id is null then
    return new;
  end if;

  update public.collection_items ci
     set item_kind = new.item_kind,
         ref_id = new.ref_id,
         quantity = new.quantity,
         grading_company = new.grading_company,
         variants = new.variants,
         grade_condition_id = new.grade_condition_id,
         collection_ref = new.collection_id,
         updated_at = now()
   where ci.collection_id = vault_collection_id
     and ci.item_kind = old.item_kind
     and ci.ref_id = old.ref_id
     and coalesce(ci.grade_condition_id::text, '') = coalesce(old.grade_condition_id::text, '')
     and coalesce(ci.grading_company, '') = coalesce(old.grading_company, '')
     and coalesce(ci.variants, '{}'::text[]) = coalesce(old.variants, '{}'::text[]);

  if not found then
    -- If no matching row existed (e.g., unique keys changed), ensure a fresh mirror exists
    if not exists (
      select 1
      from public.collection_items ci
      where ci.collection_id = vault_collection_id
        and ci.item_kind = new.item_kind
        and ci.ref_id = new.ref_id
        and coalesce(ci.grade_condition_id::text, '') = coalesce(new.grade_condition_id::text, '')
        and coalesce(ci.grading_company, '') = coalesce(new.grading_company, '')
        and coalesce(ci.variants, '{}'::text[]) = coalesce(new.variants, '{}'::text[])
    ) then
      insert into public.collection_items (
        id,
        collection_id,
        collection_ref,
        user_id,
        item_kind,
        ref_id,
        quantity,
        position,
        grading_company,
        variants,
        created_at,
        updated_at,
        grade_condition_id
      )
      values (
        gen_random_uuid(),
        vault_collection_id,
        new.collection_id,
        new.user_id,
        new.item_kind,
        new.ref_id,
        new.quantity,
        0,
        new.grading_company,
        new.variants,
        now(),
        now(),
        new.grade_condition_id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_selling_items_update_to_vault on public.collection_items;
create trigger trg_selling_items_update_to_vault
after update on public.collection_items
for each row execute function public.sync_selling_item_update_to_vault();

-- Trigger function: when a selling item is deleted, remove it from vault
create or replace function public.sync_selling_item_remove_from_vault()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_selling boolean := false;
  vault_collection_id uuid;
begin
  select coalesce(c.is_selling, false)
    into is_selling
  from public.collections c
  where c.id = old.collection_id
  limit 1;

  if not is_selling then
    return old;
  end if;

  select id
    into vault_collection_id
  from public.collections
  where user_id = old.user_id
    and coalesce(is_vault, false) = true
  limit 1;

  if vault_collection_id is null then
    return old;
  end if;

  delete from public.collection_items ci
   where ci.collection_id = vault_collection_id
     and ci.item_kind = old.item_kind
     and ci.ref_id = old.ref_id
     and coalesce(ci.grade_condition_id::text, '') = coalesce(old.grade_condition_id::text, '')
     and coalesce(ci.grading_company, '') = coalesce(old.grading_company, '')
     and coalesce(ci.variants, '{}'::text[]) = coalesce(old.variants, '{}'::text[]);

  return old;
end;
$$;

drop trigger if exists trg_selling_items_from_vault on public.collection_items;
create trigger trg_selling_items_from_vault
after delete on public.collection_items
for each row execute function public.sync_selling_item_remove_from_vault();

-- Backfill: ensure every selling item currently has a vault mirror
DO $$
declare
  rec record;
begin
  for rec in
    select c.id as selling_collection_id,
           v.id as vault_collection_id
      from public.collections c
      join public.collections v
        on v.user_id = c.user_id
       and coalesce(v.is_vault, false) = true
     where coalesce(c.is_selling, false) = true
  loop
    insert into public.collection_items (
      id,
      collection_id,
      collection_ref,
      user_id,
      item_kind,
      ref_id,
      quantity,
      position,
      grading_company,
      variants,
      created_at,
      updated_at,
      grade_condition_id
    )
    select gen_random_uuid(),
           rec.vault_collection_id,
           ci.collection_id,
           ci.user_id,
           ci.item_kind,
           ci.ref_id,
           ci.quantity,
           0,
           ci.grading_company,
           ci.variants,
           now(),
           now(),
           ci.grade_condition_id
      from public.collection_items ci
     where ci.collection_id = rec.selling_collection_id
       and not exists (
         select 1
           from public.collection_items vi
          where vi.collection_id = rec.vault_collection_id
            and vi.item_kind = ci.item_kind
            and vi.ref_id = ci.ref_id
            and coalesce(vi.grade_condition_id::text, '') = coalesce(ci.grade_condition_id::text, '')
            and coalesce(vi.grading_company, '') = coalesce(ci.grading_company, '')
            and coalesce(vi.variants, '{}'::text[]) = coalesce(ci.variants, '{}'::text[])
       );
  end loop;
end;
$$;
