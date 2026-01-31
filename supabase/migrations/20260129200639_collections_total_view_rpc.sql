-- Add helper view + RPC to expose collection totals per user without storing user_id on collection_totals.
-- Also add supporting indexes for efficient lookups by user and default collections.

-- Indexes to speed up collection lookups by owner and default flags.
create index if not exists collections_user_id_idx on public.collections (user_id);
create index if not exists collections_user_vault_idx on public.collections (user_id) where is_vault;
create index if not exists collections_user_selling_idx on public.collections (user_id) where is_selling;
create index if not exists collections_user_wishlist_idx on public.collections (user_id) where is_wishlist;
create index if not exists collection_totals_collection_id_idx on public.collection_totals (collection_id);

-- View: collection totals with owner + default flags.
create or replace view public.collection_totals_with_flags as
select
  c.user_id,
  c.id          as collection_id,
  c.is_vault,
  c.is_selling,
  c.is_wishlist,
  coalesce(t.total_cents, 0)     as total_cents,
  coalesce(t.quantity_total, 0)  as quantity_total,
  t.computed_at
from public.collections c
left join public.collection_totals t on t.collection_id = c.id;

-- RPC: aggregate totals per user for default collections (vault, selling, wishlist).
create or replace function public.collection_totals_for_user(p_user_id uuid default auth.uid())
returns table (
  user_id uuid,
  vault_total_cents int,
  selling_total_cents int,
  wishlist_total_cents int,
  vault_quantity_total int,
  selling_quantity_total int,
  wishlist_quantity_total int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.user_id,
    sum(case when c.is_vault then coalesce(t.total_cents, 0) else 0 end)        as vault_total_cents,
    sum(case when c.is_selling then coalesce(t.total_cents, 0) else 0 end)      as selling_total_cents,
    sum(case when c.is_wishlist then coalesce(t.total_cents, 0) else 0 end)     as wishlist_total_cents,
    sum(case when c.is_vault then coalesce(t.quantity_total, 0) else 0 end)     as vault_quantity_total,
    sum(case when c.is_selling then coalesce(t.quantity_total, 0) else 0 end)   as selling_quantity_total,
    sum(case when c.is_wishlist then coalesce(t.quantity_total, 0) else 0 end)  as wishlist_quantity_total
  from public.collections c
  left join public.collection_totals t on t.collection_id = c.id
  where c.user_id = coalesce(p_user_id, auth.uid())
  group by c.user_id;
$$;

grant execute on function public.collection_totals_for_user(uuid) to authenticated;
