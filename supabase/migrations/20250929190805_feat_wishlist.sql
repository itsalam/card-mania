-- Base Table ----------------------

create table public.wishlist_kind (
  name text primary key check (name ~ '^[a-z_]+$')
);

insert into public.wishlist_kind (name) values
  ('card'), ('listing'), ('set'), ('seller');

create table public.wishlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null references public.wishlist_kind(name) on delete restrict,
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref_id)
);

create index wishlist_user_id_created_at_idx on public.wishlist (user_id, created_at desc);
create index wishlist_kind_ref_idx on public.wishlist (kind, ref_id);

-- RLS Policies ----------------------
alter table public.wishlist enable row level security;

-- A user can see only their own wishlist rows
create policy "wishlist: read own"
on public.wishlist
for select
to authenticated
using (user_id = auth.uid());

-- A user can add to their own wishlist
create policy "wishlist: insert own"
on public.wishlist
for insert
to authenticated
with check (user_id = auth.uid());

-- A user can remove from their own wishlist
create policy "wishlist: delete own"
on public.wishlist
for delete
to authenticated
using (user_id = auth.uid());

-- RPC functions ------------------------------

-- integrity check function
create or replace function public.wishlist_validate_fk()
returns trigger language plpgsql as $$
declare ok boolean;
begin
  -- add branches as you add kinds
  case new.kind
    when 'card' then   select true into ok from public.cards    where id = new.ref_id;
    when 'listing' then select true into ok from public.listings where id = new.ref_id;
    when 'set' then    select true into ok from public.sets     where id = new.ref_id;
    when 'seller' then select true into ok from public.sellers  where id = new.ref_id;
    else ok := false;
  end case;

  if not coalesce(ok,false) then
    raise foreign_key_violation using message = format('No %s with id %s', new.kind, new.ref_id);
  end if;
  return new;
end $$;

-- Trigger for foreign key validation
create trigger wishlist_fk_check
before insert or update on public.wishlist
for each row execute function public.wishlist_validate_fk();

-- Toggle wishlist item (add if not exists, remove if exists)
create or replace function public.wishlist_toggle(p_kind text, p_ref_id uuid)
returns table(is_wishlisted boolean)
language plpgsql
security definer
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Try to delete first (acts as "if exists → remove")
  delete from public.wishlist 
  where user_id = v_user and kind = p_kind and ref_id = p_ref_id;

  if found then
    return query select false;
    return;
  end if;

  -- Otherwise insert
  insert into public.wishlist(user_id, kind, ref_id) values (v_user, p_kind, p_ref_id)
  on conflict do nothing;

  return query select true;
end;
$$;

grant execute on function public.wishlist_toggle(text, uuid) to authenticated;


-- Wishlist view ----------------------

create materialized view public.wishlist_counts as
select kind, ref_id, count(*)::int as wishlist_count
from public.wishlist
group by kind, ref_id;

create unique index wishlist_counts_kind_ref_id_idx on public.wishlist_counts(kind, ref_id);

-- Optional: refresh periodically (cron) or trigger after changes

