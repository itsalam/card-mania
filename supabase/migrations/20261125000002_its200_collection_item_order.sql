-- ITS-200: collectors can reorder the cards in their own collections.
--
-- collection_items.position (default 0) existed but nothing set or read it; lists were always
-- newest first. Now:
--   * collection_item_query sorts by position, then newest first. A collection that has never
--     been reordered has every position at 0, so its order is unchanged.
--   * reorder_collection_items saves an order: positions 1..n, by card. Copies of the same card
--     (one grouped row in the app) share a position and move together.
--   * New cards keep the default position 0, so they land above the custom-ordered ones,
--     newest first.
--
-- Paging moves from a created_at cursor to (position, created_at). The new p_page_position
-- parameter is optional: installed builds that send only p_page_param are treated as position
-- 0, which is exact for collections that were never reordered.
--
-- Also fixes grouped paging: the old `ref_rank <= page_size` filter ranked groups across the
-- whole collection, so every page after the first came back empty. The final LIMIT already
-- caps the page.

drop function if exists public.collection_item_query(uuid, timestamptz, text, integer, boolean);

create function public.collection_item_query(
  p_collection_id uuid,
  p_page_param timestamptz default null,
  p_search text default null,
  p_page_size integer default 20,
  p_group boolean default false,
  p_page_position integer default null
)
returns table (
  collection_item_id uuid, collection_id uuid, collection_ref uuid, user_id uuid,
  item_kind public.item_kind, ref_id uuid, grade_condition_id uuid, grading_company text,
  "position" integer, quantity integer, variants text[], created_at timestamptz,
  updated_at timestamptz, id uuid, name text, set_name text, latest_price numeric,
  grades_prices jsonb, genre text, last_updated timestamptz, front_id text, back_id text,
  extras text[], price_key text, collection_item_value integer, primary_image_cache_id uuid,
  primary_image_storage_path text, primary_image_width integer, primary_image_height integer,
  -- The row's sort key, for the next page's cursor (pass as p_page_position / p_page_param).
  sort_position integer, sort_created_at timestamptz
)
language sql
stable
set search_path to 'public'
as $function$
with base as (
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
        cii.height         as primary_image_height,
        max(ci.created_at) over (partition by ci.ref_id) as ref_latest_created_at,
        min(ci.position)   over (partition by ci.ref_id) as ref_position,
        row_number() over (
            partition by ci.ref_id
            order by ci.created_at desc
        )                                                 as ref_rownum
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
keyed as (
    select
        *,
        case when p_group then ref_position else "position" end              as k_position,
        case when p_group then ref_latest_created_at else created_at end     as k_created_at
    from base
    where p_group = false or ref_rownum = 1
),
filtered as (
    select *
    from keyed
    where
        p_page_param is null
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
    coalesce((r.grades_prices ->> r.price_key)::int, 0) as collection_item_value,
    r.primary_image_cache_id,
    r.primary_image_storage_path,
    r.primary_image_width,
    r.primary_image_height,
    r.k_position   as sort_position,
    r.k_created_at as sort_created_at
from filtered r
order by r.k_position asc, r.k_created_at desc, r.ref_id, r.collection_item_id
limit coalesce(p_page_size, 20);
$function$;

grant execute on function public.collection_item_query(uuid, timestamptz, text, integer, boolean, integer)
  to anon, authenticated, service_role;

-- Saves the order of a collection's cards. p_ref_ids lists every card in the collection once,
-- first to last; all copies of a card get that card's position (1-based).
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
end;
$$;

revoke all on function public.reorder_collection_items(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_collection_items(uuid, uuid[]) to authenticated;
