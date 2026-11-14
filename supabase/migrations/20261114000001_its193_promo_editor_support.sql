-- ITS-193: read helpers for the Retool promo editor.
--
--   admin.search_card_sets(query, limit)   set picker autocomplete (distinct cards.set_name)
--   admin.search_cards(query, set, limit)  find a card to pin
--   admin.lookup_cards(ref_ids)            names + thumbnails for pinned / excluded chips
--   admin.preview_promo_matches(...)       now also returns each card's thumbnail
--
-- Thumbnails: the card's front image binding (card_images → image_cache.storage_path in the
-- public `images` bucket), else its source_url while the image is still being fetched, the
-- same lookup image-proxy does. The editor builds the public URL from the path.

-- Front image of a card: { image_path, image_source_url } (either may be null).
create or replace function admin._card_front_image(p_card_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object('image_path', coalesce(ic.storage_path, ci.storage_path),
                              'image_source_url', ci.source_url)
      from public.card_images ci
      left join public.image_cache ic on ic.id = ci.image_cache_id
     where ci.card_id = p_card_id and ci.kind = 'front'
     order by ci.is_primary desc nulls last, (coalesce(ic.storage_path, ci.storage_path) is not null) desc,
              ci.updated_at desc
     limit 1
  ), jsonb_build_object('image_path', null, 'image_source_url', null));
$$;

create or replace function admin.search_card_sets(p_query text default '', p_limit int default 20)
returns table (set_name text, genre text, card_count int, release_year int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := lower(btrim(coalesce(p_query, '')));
begin
  perform admin._require_role('editor');
  return query
    select c.set_name,
           mode() within group (order by c.genre),
           count(*)::int,
           max(extract(year from c.release_date))::int
      from public.cards c
     where c.set_name is not null
       and (v_q = '' or lower(c.set_name) like '%' || v_q || '%')
     group by c.set_name
     order by (lower(c.set_name) like v_q || '%') desc,
              max(c.release_date) desc nulls last,
              c.set_name
     limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

create or replace function admin.search_cards(p_query text, p_set_name text default null, p_limit int default 20)
returns table (ref_id uuid, name text, set_name text, release_year int, image_path text, image_source_url text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := lower(btrim(coalesce(p_query, '')));
begin
  perform admin._require_role('editor');
  if char_length(v_q) < 2 then
    return;
  end if;
  return query
    select c.id, c.name, c.set_name, extract(year from c.release_date)::int,
           img ->> 'image_path', img ->> 'image_source_url'
      from public.cards c
      cross join lateral admin._card_front_image(c.id) img
     where lower(c.name) like '%' || v_q || '%'
       and (p_set_name is null or lower(c.set_name) = lower(p_set_name))
     order by (lower(c.name) like v_q || '%') desc, c.release_date desc nulls last, c.name
     limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

create or replace function admin.lookup_cards(p_ref_ids uuid[])
returns table (ref_id uuid, name text, set_name text, image_path text, image_source_url text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin._require_role('editor');
  return query
    select c.id, c.name, c.set_name, img ->> 'image_path', img ->> 'image_source_url'
      from unnest(coalesce(p_ref_ids, '{}')) with ordinality as r(id, ord)
      join public.cards c on c.id = r.id
      cross join lateral admin._card_front_image(c.id) img
     order by r.ord;
end;
$$;

-- Same as 20261114000000 plus image_path / image_source_url per sample card.
create or replace function admin.preview_promo_matches(
  p_filter   jsonb  default '{}',
  p_order_by text   default 'popularity',
  p_pinned   uuid[] default '{}',
  p_excluded uuid[] default '{}',
  p_limit    int    default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_filter jsonb;
  v_count  int;
  v_sample jsonb;
begin
  perform admin._require_role('editor');
  if p_filter ? 'pin_ref_ids' or p_filter ? 'exclude_ref_ids' then
    raise exception 'pass pins and exclusions as p_pinned / p_excluded' using errcode = '22023';
  end if;
  v_filter := coalesce(p_filter, '{}'::jsonb)
              || case when cardinality(p_pinned) > 0
                      then jsonb_build_object('pin_ref_ids', to_jsonb(p_pinned)) else '{}' end
              || case when cardinality(p_excluded) > 0
                      then jsonb_build_object('exclude_ref_ids', to_jsonb(p_excluded)) else '{}' end;

  with m as (
    select * from public.marketplace_feed_listings(v_filter, coalesce(p_order_by, 'popularity'), 1001)
  )
  select count(*)::int,
         coalesce(jsonb_agg(jsonb_build_object(
                    'rank', m.rank,
                    'collection_item_id', m.collection_item_id,
                    'ref_id', m.payload ->> 'ref_id',
                    'name', m.payload ->> 'name',
                    'set_name', m.payload ->> 'set_name',
                    'front_id', m.payload ->> 'front_id',
                    'market_value', (m.payload ->> 'market_value')::int,
                    'grading_company', m.payload ->> 'grading_company',
                    'seller_username', m.payload ->> 'seller_username',
                    'pinned', (m.payload ->> 'ref_id')::uuid = any (p_pinned))
                    || admin._card_front_image((m.payload ->> 'ref_id')::uuid)
                    order by m.rank) filter (where m.rank <= least(greatest(p_limit, 0), 50)), '[]'::jsonb)
    into v_count, v_sample
    from m;

  return jsonb_build_object('count', least(v_count, 1000), 'count_capped', v_count > 1000, 'sample', v_sample);
end;
$$;

revoke all on function admin._card_front_image(uuid) from public, anon, authenticated;
revoke all on function admin.search_card_sets(text, int) from public, anon;
revoke all on function admin.search_cards(text, text, int) from public, anon;
revoke all on function admin.lookup_cards(uuid[]) from public, anon;
grant execute on function admin.search_card_sets(text, int)    to authenticated, service_role;
grant execute on function admin.search_cards(text, text, int)  to authenticated, service_role;
grant execute on function admin.lookup_cards(uuid[])           to authenticated, service_role;
grant execute on function admin._card_front_image(uuid)        to service_role;
