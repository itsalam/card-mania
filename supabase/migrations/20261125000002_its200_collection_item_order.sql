-- ITS-200: collectors can reorder the cards in their own collections, and every collection has a
-- sort.
--
-- Sorts (collections.item_sort, chosen by the owner; anyone viewing can pass their own p_sort):
--   custom      position, then newest first. collection_items.position (default 0) existed but
--               nothing set or read it. A collection that has never been reordered has every
--               position at 0, so this is newest first. New cards keep position 0, so they land
--               above the custom-ordered ones.
--   newest      date added, newest first
--   oldest      date added, oldest first
--   price_desc  market value for the item's grade, highest first; unpriced cards last
--   price_asc   market value, lowest first; unpriced cards last
--   popular     the app-wide card popularity score (wishlists + completed sales, the same s_pop
--               formula as search and the marketplace sections), highest first
-- Grouped lists (one row per card) sort a card by its newest copy, its oldest copy or its most
-- valuable copy.
--
-- reorder_collection_items saves an order: positions 1..n, by card (copies move together), and
-- switches the collection to the custom sort.
--
-- Paging: clients that send p_page_offset get offset paging in any sort. Installed builds that
-- don't send it keep the (position, created_at) cursor in the custom sort: p_page_position is
-- optional, and a build that sends only p_page_param is treated as position 0, which is exact for
-- collections that were never reordered.
--
-- Also fixes grouped paging: the old `ref_rank <= page_size` filter ranked groups across the
-- whole collection, so every page after the first came back empty. The final LIMIT already
-- caps the page.

alter table public.collections
  add column if not exists item_sort text not null default 'custom'
    constraint collections_item_sort_check
      check (item_sort in ('custom', 'newest', 'oldest', 'price_desc', 'price_asc', 'popular'));

comment on column public.collections.item_sort is
  'ITS-200: how the collection''s cards are sorted by default. See collection_item_query.';

-- Popularity score (0..1) for the given cards. Same formula as s_pop in search_cards_blended and
-- popularity_score in _marketplace_base_listings: wishlist count and completed-sale count,
-- log-scaled, weighted by search_config. SECURITY DEFINER so it counts every wishlist, not only
-- the caller's; it returns scores, never whose wishlists they are.
create or replace function public.card_popularity(p_ref_ids uuid[])
returns table (ref_id uuid, score numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with cfg as (
    select pop_wishlist_weight, pop_sale_weight, pop_log_divisor
      from public.search_config where id = 1
  ),
  wishlist_counts as (
    select ci.ref_id, count(*) as cnt
      from public.collection_items ci
      join public.collections col on col.id = ci.collection_id and col.is_wishlist = true
     where ci.item_kind = 'card' and ci.ref_id = any(p_ref_ids)
     group by ci.ref_id
  ),
  sale_counts as (
    select ci.ref_id, count(*) as cnt
      from public.transactions t
      join public.offer_items oi on oi.offer_id = t.offer_id
      join public.collection_items ci on ci.id = oi.collection_item_id
     where t.status = 'completed' and ci.ref_id = any(p_ref_ids)
     group by ci.ref_id
  )
  select r.ref_id,
         least(1.0,
           (  cfg.pop_wishlist_weight * log(1.0 + coalesce(wl.cnt, 0)::numeric)
            + cfg.pop_sale_weight     * log(1.0 + coalesce(sl.cnt, 0)::numeric)
           ) / cfg.pop_log_divisor)
    from unnest(p_ref_ids) as r(ref_id)
    cross join cfg
    left join wishlist_counts wl on wl.ref_id = r.ref_id
    left join sale_counts sl on sl.ref_id = r.ref_id
$$;

revoke all on function public.card_popularity(uuid[]) from public;
grant execute on function public.card_popularity(uuid[]) to anon, authenticated, service_role;

drop function if exists public.collection_item_query(uuid, timestamptz, text, integer, boolean);
drop function if exists public.collection_item_query(uuid, timestamptz, text, integer, boolean, integer);

create function public.collection_item_query(
  p_collection_id uuid,
  p_page_param timestamptz default null,
  p_search text default null,
  p_page_size integer default 20,
  p_group boolean default false,
  p_page_position integer default null,
  -- null: the collection's item_sort (offset paging) or custom (legacy cursor paging)
  p_sort text default null,
  -- rows to skip; sending it (0 for the first page) switches to offset paging
  p_page_offset integer default null
)
returns table (
  collection_item_id uuid, collection_id uuid, collection_ref uuid, user_id uuid,
  item_kind public.item_kind, ref_id uuid, grade_condition_id uuid, grading_company text,
  "position" integer, quantity integer, variants text[], created_at timestamptz,
  updated_at timestamptz, id uuid, name text, set_name text, latest_price numeric,
  grades_prices jsonb, genre text, last_updated timestamptz, front_id text, back_id text,
  extras text[], price_key text, collection_item_value integer, primary_image_cache_id uuid,
  primary_image_storage_path text, primary_image_width integer, primary_image_height integer,
  -- The row's legacy cursor (p_page_position / p_page_param). Offset clients ignore it.
  sort_position integer, sort_created_at timestamptz
)
language sql
stable
set search_path to 'public'
as $function$
with settings as (
    select case
             when p_page_offset is null then 'custom'
             else coalesce(
               p_sort,
               (select col.item_sort from public.collections col where col.id = p_collection_id),
               'custom')
           end as sort
),
raw as (
    select
        ci.id              as collection_item_id,
        ci.collection_id,
        ci.collection_ref,
        ci.user_id,
        ci.item_kind,
        ci.ref_id,
        ci.grade_condition_id,
        ci.grading_company,
        ci.position        as "position",
        ci.quantity,
        ci.variants,
        ci.created_at,
        ci.updated_at,
        c.id,
        c.name,
        c.set_name,
        c.latest_price,
        c.grades_prices,
        c.genre,
        c.last_updated,
        c.front_id,
        c.back_id,
        c.extras,
        coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded') as price_key,
        cii.image_cache_id as primary_image_cache_id,
        cii.storage_path   as primary_image_storage_path,
        cii.width          as primary_image_width,
        cii.height         as primary_image_height
    from
        public.collection_items ci
        left join public.cards c
            on ci.item_kind = 'card'::public.item_kind and ci.ref_id = c.id
        left join public.grade_conditions gcnd on gcnd.id = ci.grade_condition_id
        left join public.grading_companies gc  on gc.id  = gcnd.company_id
        left join public.collection_item_images cii
            on cii.collection_item_id = ci.id and cii.is_primary
    where
        ci.collection_id = p_collection_id
        and (
            p_search is null
            or p_search = ''
            or (
                ci.item_kind = 'card'::public.item_kind
                and (
                    c.name % p_search
                    or c.set_name % p_search
                    or word_similarity(p_search, c.name)     > (select trgm_word_similarity_threshold from public.search_config where id = 1)
                    or word_similarity(p_search, c.set_name) > (select trgm_word_similarity_threshold from public.search_config where id = 1)
                )
            )
        )
),
valued as (
    select *, coalesce((grades_prices ->> price_key)::int, 0) as item_value
    from raw
),
base as (
    select
        v.*,
        max(v.created_at) over (partition by v.ref_id) as ref_latest_created_at,
        min(v.created_at) over (partition by v.ref_id) as ref_first_created_at,
        min(v."position") over (partition by v.ref_id) as ref_position,
        max(v.item_value) over (partition by v.ref_id) as ref_max_value,
        row_number() over (
            partition by v.ref_id
            order by v.created_at desc
        )                                                as ref_rownum
    from valued v
),
-- Scores only when sorting by popularity; otherwise an empty lookup.
pop as (
    select p.ref_id, p.score
    from public.card_popularity(
        case when (select sort from settings) = 'popular'
             then array(select distinct b.ref_id from base b where b.item_kind = 'card'::public.item_kind)
             else '{}'::uuid[] end
    ) p
),
keyed as (
    select
        b.*,
        case when p_group then b.ref_position else b."position" end                  as k_position,
        case when p_group then b.ref_latest_created_at else b.created_at end         as k_created_at,
        case when p_group then b.ref_first_created_at else b.created_at end          as k_first_created_at,
        -- 0 means no price for this grade: sort it last either way.
        nullif(case when p_group then b.ref_max_value else b.item_value end, 0)      as k_value,
        coalesce(pop.score, 0)                                                       as k_popularity
    from base b
    left join pop on pop.ref_id = b.ref_id
    where p_group = false or b.ref_rownum = 1
),
filtered as (
    select *
    from keyed
    where
        -- Legacy cursor paging (custom sort only).
        p_page_offset is not null
        or p_page_param is null
        or k_position > coalesce(p_page_position, 0)
        or (k_position = coalesce(p_page_position, 0) and k_created_at < p_page_param)
)
select
    r.collection_item_id,
    r.collection_id,
    r.collection_ref,
    r.user_id,
    r.item_kind,
    r.ref_id,
    r.grade_condition_id,
    r.grading_company,
    r."position",
    r.quantity,
    r.variants,
    r.created_at,
    r.updated_at,
    r.id,
    r.name,
    r.set_name,
    r.latest_price,
    r.grades_prices,
    r.genre,
    r.last_updated,
    r.front_id,
    r.back_id,
    r.extras,
    r.price_key,
    r.item_value as collection_item_value,
    r.primary_image_cache_id,
    r.primary_image_storage_path,
    r.primary_image_width,
    r.primary_image_height,
    r.k_position   as sort_position,
    r.k_created_at as sort_created_at
from filtered r
cross join settings s
order by
    case when s.sort = 'custom'     then r.k_position end asc,
    case when s.sort = 'oldest'     then r.k_first_created_at end asc,
    case when s.sort = 'price_desc' then r.k_value end desc nulls last,
    case when s.sort = 'price_asc'  then r.k_value end asc nulls last,
    case when s.sort = 'popular'    then r.k_popularity end desc,
    -- custom and newest, and the tie-break for everything else: newest first.
    r.k_created_at desc,
    r.ref_id,
    r.collection_item_id
limit coalesce(p_page_size, 20)
offset coalesce(p_page_offset, 0);
$function$;

grant execute on function public.collection_item_query(uuid, timestamptz, text, integer, boolean, integer, text, integer)
  to anon, authenticated, service_role;

-- Saves the order of a collection's cards and switches it to the custom sort. p_ref_ids lists
-- every card in the collection once, first to last; all copies of a card get that card's
-- position (1-based).
create or replace function public.reorder_collection_items(p_collection_id uuid, p_ref_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_is_selling boolean;
  v_expected int;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select user_id, coalesce(is_selling, false) into v_owner, v_is_selling
    from public.collections where id = p_collection_id for update;
  if not found or v_owner <> v_uid then
    raise exception 'Collection not found' using errcode = 'P0002';
  end if;
  -- Selling mirrors storefront items and is grouped by source collection; updating it
  -- cascades into the Vault and the source rows. Its order isn't the user's to set.
  if v_is_selling then
    raise exception 'The Selling collection can''t be reordered' using errcode = '22023';
  end if;

  if p_ref_ids is null or cardinality(p_ref_ids) <> (select count(distinct x) from unnest(p_ref_ids) x) then
    raise exception 'Each card must appear once' using errcode = '22023';
  end if;

  -- The order must cover exactly the cards in the collection, so a stale list (a card added
  -- or removed in the meantime) can't scramble positions.
  select count(distinct ref_id) into v_expected
    from public.collection_items where collection_id = p_collection_id;
  if v_expected <> cardinality(p_ref_ids)
     or exists (
       select 1 from unnest(p_ref_ids) r(ref_id)
        where not exists (select 1 from public.collection_items ci
                           where ci.collection_id = p_collection_id and ci.ref_id = r.ref_id)
     ) then
    raise exception 'This collection changed; reload and try again' using errcode = '40001';
  end if;

  update public.collection_items ci
     set position = o.ord
    from unnest(p_ref_ids) with ordinality as o(ref_id, ord)
   where ci.collection_id = p_collection_id
     and ci.ref_id = o.ref_id
     and ci.position is distinct from o.ord::int;

  update public.collections set item_sort = 'custom'
   where id = p_collection_id and item_sort <> 'custom';
end;
$$;

revoke all on function public.reorder_collection_items(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_collection_items(uuid, uuid[]) to authenticated;
