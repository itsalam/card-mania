-- ITS-97: curated / customized marketplace feeds as data.
--
-- Until now every marketplace section was a hardcoded branch in refresh_marketplace_sections().
-- A section can now be `kind = 'custom'`: a marketplace_section_meta row whose `filter` (a
-- small, allowlisted criteria vocabulary) and `order_by` say what it holds. Custom sections are
-- populated by the marketplace-feed-refresh edge function on their own refresh_interval and
-- served through the unchanged get_marketplace_sections() read path, so adding a feed is an
-- INSERT — no migration, no SQL change, no client change.
--
--   pg_cron (*/5) ─▶ marketplace-feed-refresh ─▶ due_marketplace_feeds()
--                                              ─▶ marketplace_feed_listings(filter, order_by, limit)
--                                              ─▶ write_marketplace_section(key, rows)
--
-- Built-in sections keep their SQL branches and 15-minute DB cron (refresh_marketplace_sections
-- now skips custom rows). Raw stored SQL per section (the issue's "mechanism B") is deliberately
-- not implemented: every feed so far fits the vocabulary, and arbitrary SQL would need its own
-- trust boundary. Extend the vocabulary below (and _shared/marketplace-feed.ts) instead.
--
-- Filter vocabulary (all keys optional, AND-ed):
--   genres            text[]   cards.genre in list (case-insensitive)
--   sets              text[]   cards.set_name in list (case-insensitive)
--   name_query        text     every whitespace-separated term appears in cards.name (player feeds)
--   ref_ids           uuid[]   specific cards
--   seller_ids        uuid[]   specific sellers
--   sealed            boolean
--   graded            boolean  true = has a grading company, false = raw
--   grading_companies text[]   e.g. {"PSA","BGS"} (case-insensitive)
--   min_value_cents   int      market value floor (cents, same units as grades_prices)
--   max_value_cents   int      market value ceiling
--   release_year_min  int      cards.release_date year >= (e.g. 2026 for "Best of 2026")
--   release_year_max  int
--   listed_within_days int     storefront listed in the last N days
-- order_by: 'popularity' (default) | 'value_desc' | 'value_asc' | 'newest'

alter table public.marketplace_section_meta
  add column if not exists kind     text  not null default 'builtin',
  add column if not exists filter   jsonb not null default '{}'::jsonb,
  add column if not exists order_by text  not null default 'popularity';

alter table public.marketplace_section_meta
  drop constraint if exists marketplace_section_meta_kind_check,
  add constraint marketplace_section_meta_kind_check check (kind in ('builtin', 'custom')),
  drop constraint if exists marketplace_section_meta_order_by_check,
  add constraint marketplace_section_meta_order_by_check
    check (order_by in ('popularity', 'value_desc', 'value_asc', 'newest'));

-- Rejects unknown filter keys and wrongly-typed values at write time, so a typo'd feed fails
-- loudly instead of silently matching everything.
create or replace function public.marketplace_feed_filter_errors(p_filter jsonb)
returns text[]
language plpgsql
immutable
as $$
declare
  v_errors text[] := '{}';
  v_key    text;
  v_val    jsonb;
  v_types  constant jsonb := '{
    "genres": "text[]", "sets": "text[]", "name_query": "text", "ref_ids": "uuid[]",
    "seller_ids": "uuid[]", "sealed": "boolean", "graded": "boolean",
    "grading_companies": "text[]", "min_value_cents": "int", "max_value_cents": "int",
    "release_year_min": "int", "release_year_max": "int", "listed_within_days": "int"
  }';
  v_type   text;
begin
  if jsonb_typeof(p_filter) is distinct from 'object' then
    return array['filter must be a JSON object'];
  end if;
  for v_key, v_val in select * from jsonb_each(p_filter) loop
    v_type := v_types ->> v_key;
    if v_type is null then
      v_errors := v_errors || format('unknown filter key "%s"', v_key);
    elsif v_type = 'text' and jsonb_typeof(v_val) <> 'string' then
      v_errors := v_errors || format('"%s" must be a string', v_key);
    elsif v_type = 'boolean' and jsonb_typeof(v_val) <> 'boolean' then
      v_errors := v_errors || format('"%s" must be a boolean', v_key);
    elsif v_type = 'int' and (jsonb_typeof(v_val) <> 'number' or v_val::numeric <> trunc(v_val::numeric)) then
      v_errors := v_errors || format('"%s" must be an integer', v_key);
    elsif v_type in ('text[]', 'uuid[]') and (
            jsonb_typeof(v_val) <> 'array'
            or exists (select 1 from jsonb_array_elements(v_val) e where jsonb_typeof(e) <> 'string')) then
      v_errors := v_errors || format('"%s" must be an array of strings', v_key);
    elsif v_type = 'uuid[]' and exists (
            select 1 from jsonb_array_elements_text(v_val) e
             where e !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
      v_errors := v_errors || format('"%s" must contain UUIDs', v_key);
    end if;
  end loop;
  return v_errors;
end;
$$;

alter table public.marketplace_section_meta
  drop constraint if exists marketplace_section_meta_filter_check,
  add constraint marketplace_section_meta_filter_check
    check (cardinality(public.marketplace_feed_filter_errors(filter)) = 0);

-- ── Built-in refresh now leaves custom sections alone ───────────────────────────────────────
-- Body verbatim from 20260721000000 apart from the `kind = 'builtin'` filter.
create or replace function public.refresh_marketplace_sections()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sec record;
begin
  for sec in
    select * from public.marketplace_section_meta
     where enabled and kind = 'builtin'
     order by sort_order
  loop
    delete from public.marketplace_section_items where section_key = sec.key;

    if sec.key = 'featured' then
      -- Curated feed: most wished-for / best-selling first.
      insert into public.marketplace_section_items (section_key, rank, collection_item_id, payload, computed_at)
      select sec.key,
             row_number() over (order by b.popularity_score desc nulls last,
                                          b.listed_at desc nulls last,
                                          b.collection_item_id),
             b.collection_item_id, to_jsonb(b), now()
      from public._marketplace_base_listings() b
      order by b.popularity_score desc nulls last, b.listed_at desc nulls last, b.collection_item_id
      limit sec.result_limit;

    elsif sec.key = 'auctions_graded' then
      -- Graded storefront items, highest market value first.
      insert into public.marketplace_section_items (section_key, rank, collection_item_id, payload, computed_at)
      select sec.key,
             row_number() over (order by b.market_value desc nulls last,
                                          b.popularity_score desc nulls last,
                                          b.collection_item_id),
             b.collection_item_id, to_jsonb(b), now()
      from public._marketplace_base_listings() b
      where b.grading_company is not null
      order by b.market_value desc nulls last, b.popularity_score desc nulls last, b.collection_item_id
      limit sec.result_limit;

    elsif sec.key = 'auctions_sealed' then
      -- Sealed product (cards.sealed = true), highest market value first.
      insert into public.marketplace_section_items (section_key, rank, collection_item_id, payload, computed_at)
      select sec.key,
             row_number() over (order by b.market_value desc nulls last,
                                          b.popularity_score desc nulls last,
                                          b.collection_item_id),
             b.collection_item_id, to_jsonb(b), now()
      from public._marketplace_base_listings() b
      where b.sealed = true
      order by b.market_value desc nulls last, b.popularity_score desc nulls last, b.collection_item_id
      limit sec.result_limit;
    end if;

    update public.marketplace_section_meta
       set refreshed_at = now(),
           expires_at   = now() + refresh_interval,
           updated_at   = now()
     where key = sec.key;
  end loop;
end;
$$;

-- ── Feed query ──────────────────────────────────────────────────────────────────────────────

-- Translates a criteria object into a parameterized query over _marketplace_base_listings().
-- Returns rows in rank order with the same payload shape the built-in sections cache.
create or replace function public.marketplace_feed_listings(
  p_filter jsonb, p_order_by text default 'popularity', p_limit int default 20
)
returns table (rank int, collection_item_id uuid, payload jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_errors text[] := public.marketplace_feed_filter_errors(coalesce(p_filter, '{}'::jsonb));
  f jsonb := coalesce(p_filter, '{}'::jsonb);
  v_terms text[];
begin
  if cardinality(v_errors) > 0 then
    raise exception 'invalid feed filter: %', array_to_string(v_errors, '; ') using errcode = '22023';
  end if;
  if p_order_by not in ('popularity', 'value_desc', 'value_asc', 'newest') then
    raise exception 'invalid order_by: %', p_order_by using errcode = '22023';
  end if;
  v_terms := case when f ? 'name_query'
                  then regexp_split_to_array(lower(trim(f ->> 'name_query')), '\s+') end;

  return query
  with
  arr as (
    select
      (select array_agg(lower(x)) from jsonb_array_elements_text(f -> 'genres') x)            as genres,
      (select array_agg(lower(x)) from jsonb_array_elements_text(f -> 'sets') x)              as sets,
      (select array_agg(x::uuid)  from jsonb_array_elements_text(f -> 'ref_ids') x)           as ref_ids,
      (select array_agg(x::uuid)  from jsonb_array_elements_text(f -> 'seller_ids') x)        as seller_ids,
      (select array_agg(lower(x)) from jsonb_array_elements_text(f -> 'grading_companies') x) as companies
  ),
  matched as (
    select b.*
      from public._marketplace_base_listings() b
      cross join arr
      left join public.cards c on c.id = b.ref_id
     where (arr.genres     is null or lower(b.genre) = any (arr.genres))
       and (arr.sets       is null or lower(b.set_name) = any (arr.sets))
       and (arr.ref_ids    is null or b.ref_id = any (arr.ref_ids))
       and (arr.seller_ids is null or b.seller_id = any (arr.seller_ids))
       and (arr.companies  is null or lower(b.grading_company) = any (arr.companies))
       and (v_terms is null or (select bool_and(strpos(lower(b.name), t) > 0) from unnest(v_terms) t))
       and (not f ? 'sealed' or b.sealed = (f ->> 'sealed')::boolean)
       and (not f ? 'graded' or (b.grading_company is not null) = (f ->> 'graded')::boolean)
       and (not f ? 'min_value_cents' or b.market_value >= (f ->> 'min_value_cents')::int)
       and (not f ? 'max_value_cents' or b.market_value <= (f ->> 'max_value_cents')::int)
       and (not f ? 'release_year_min' or extract(year from c.release_date) >= (f ->> 'release_year_min')::int)
       and (not f ? 'release_year_max' or extract(year from c.release_date) <= (f ->> 'release_year_max')::int)
       and (not f ? 'listed_within_days'
            or b.listed_at >= now() - make_interval(days => (f ->> 'listed_within_days')::int))
  ),
  ranked as (
    select m.*,
           row_number() over (
             order by
               case when p_order_by = 'popularity' then m.popularity_score end desc nulls last,
               case when p_order_by = 'value_desc' then m.market_value end desc nulls last,
               case when p_order_by = 'value_asc'  then m.market_value end asc nulls last,
               case when p_order_by = 'newest'     then m.listed_at end desc nulls last,
               m.popularity_score desc nulls last,
               m.listed_at desc nulls last,
               m.collection_item_id
           )::int as rn
      from matched m
  )
  select r.rn, r.collection_item_id,
         to_jsonb(r) - 'rn'
    from ranked r
   where r.rn <= greatest(coalesce(p_limit, 20), 0)
   order by r.rn;
end;
$$;

-- ── Edge-function write contract ────────────────────────────────────────────────────────────

-- Custom sections whose cache has expired (or was never filled), oldest first.
create or replace function public.due_marketplace_feeds(p_keys text[] default null, p_force boolean default false)
returns table (key text, filter jsonb, order_by text, result_limit int)
language sql
stable
security definer
set search_path = public
as $$
  select m.key, m.filter, m.order_by, m.result_limit
    from public.marketplace_section_meta m
   where m.kind = 'custom'
     and m.enabled
     and (p_keys is null or m.key = any (p_keys))
     and (p_force or m.expires_at is null or m.expires_at <= now())
   order by m.expires_at nulls first, m.sort_order;
$$;

-- Same write contract as refresh_marketplace_sections(): replace the section's rows by rank,
-- stamp refreshed_at / expires_at. p_rows: [{ "rank": 1, "collection_item_id": "...", "payload": {...} }]
create or replace function public.write_marketplace_section(p_key text, p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not exists (select 1 from public.marketplace_section_meta where key = p_key and kind = 'custom') then
    raise exception 'unknown custom section %', p_key using errcode = '22023';
  end if;

  delete from public.marketplace_section_items where section_key = p_key;
  insert into public.marketplace_section_items (section_key, rank, collection_item_id, payload, computed_at)
  select p_key, r.rank, r.collection_item_id, r.payload, now()
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
         as r(rank int, collection_item_id uuid, payload jsonb);
  get diagnostics v_count = row_count;

  update public.marketplace_section_meta
     set refreshed_at = now(),
         expires_at   = now() + refresh_interval,
         updated_at   = now()
   where key = p_key;
  return v_count;
end;
$$;

revoke all on function public.marketplace_feed_listings(jsonb, text, int) from public, anon, authenticated;
revoke all on function public.due_marketplace_feeds(text[], boolean) from public, anon, authenticated;
revoke all on function public.write_marketplace_section(text, jsonb) from public, anon, authenticated;
grant execute on function public.marketplace_feed_listings(jsonb, text, int) to service_role;
grant execute on function public.due_marketplace_feeds(text[], boolean) to service_role;
grant execute on function public.write_marketplace_section(text, jsonb) to service_role;

-- ── Seed curated feeds ──────────────────────────────────────────────────────────────────────
-- Sorted after the built-ins. An empty custom section is hidden by the marketplace screen
-- (only Featured renders its empty state), so a feed with no matches yet costs nothing.
insert into public.marketplace_section_meta
  (key, title, enabled, sort_order, result_limit, refresh_interval, kind, filter, order_by)
values
  ('deals_under_50', 'Deals under $50', true, 10, 20, '30 minutes', 'custom',
   '{"max_value_cents": 5000, "min_value_cents": 1}', 'popularity'),
  ('best_of_2026', 'Best of 2026', true, 11, 20, '1 hour', 'custom',
   '{"release_year_min": 2026, "release_year_max": 2026}', 'value_desc'),
  ('shohei_ohtani', 'Shohei Ohtani', true, 12, 20, '1 hour', 'custom',
   '{"name_query": "shohei ohtani"}', 'value_desc')
on conflict (key) do nothing;

-- ── Schedule ────────────────────────────────────────────────────────────────────────────────
-- Every 5 minutes; the function only recomputes sections whose own refresh_interval has
-- elapsed. Same Vault-secret contract as tracked-price-refresh.
select cron.unschedule('marketplace-feed-refresh')
where exists (select 1 from cron.job where jobname = 'marketplace-feed-refresh');

select cron.schedule(
  'marketplace-feed-refresh',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/marketplace-feed-refresh',
    headers := jsonb_build_object(
      'content-type',  'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_token'),
      'apikey',        (select decrypted_secret from vault.decrypted_secrets where name = 'edge_token'),
      'x-internal',    '1'
    )
  ) as request_id
  where exists (select 1 from public.due_marketplace_feeds());
  $$
);
