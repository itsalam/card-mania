-- ITS-57: tune public.search_config from the admin console.
--
--   admin.search_config_get()                          current values + the last 20 changes   (ops)
--   admin.update_search_config(changes, reason)        validated partial update, audited      (ops)
--   admin.preview_search_config(query, changes, limit) ranks a query with the current and the
--                                                       proposed values side by side; writes nothing
--
-- Only the knobs below are editable. prefetch_enabled (set hourly by search-prefetch-flag-update)
-- and suggestion_query_idx (advanced hourly by search-cache-warmup) stay owned by their cron jobs.
-- Search results are cached for up to PRICECHARTING_CACHE_TTL (5 min) by price-charting, so a
-- saved change shows in the app once a query's cache entry expires.
-- Field meanings and tuning notes: docs/search-scoring.md.

-- Editable fields with their bounds. One place, shared by validation and the console.
create or replace function admin._search_config_fields()
returns table (field text, kind text, min_value numeric, max_value numeric)
language sql
immutable
set search_path = ''
as $$
  values
    ('weight_fts',                     'numeric', 0,  1),
    ('weight_trgm',                    'numeric', 0,  1),
    ('weight_vector',                  'numeric', 0,  1),
    ('weight_pop',                     'numeric', 0,  1),
    ('pop_wishlist_weight',            'numeric', 0,  1),
    ('pop_sale_weight',                'numeric', 0,  1),
    ('pop_log_divisor',                'numeric', 0.1, 100),
    ('trgm_word_similarity_threshold', 'numeric', 0,  1),
    ('min_score',                      'numeric', 0,  1),
    ('snippet_max_words',              'integer', 2,  100),
    ('snippet_min_words',              'integer', 1,  99),
    ('snippet_max_fragments',          'integer', 0,  10),
    ('prefetch_threshold_ms',          'integer', 50, 10000),
    ('suggestion_queries',             'text[]',  1,  50)   -- bounds = number of queries
$$;

-- The row as it would be after p_changes, validated. Raises 22023 naming the field on any
-- unknown, read-only or out-of-range value. Writes nothing.
create or replace function admin._search_config_next(p_changes jsonb)
returns public.search_config
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cur  public.search_config;
  v_next public.search_config;
  v_key  text;
  v_f    record;
  v_num  numeric;
  v_q    text;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'changes must be a JSON object' using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(p_changes) loop
    select * into v_f from admin._search_config_fields() f where f.field = v_key;
    if not found then
      raise exception '% can''t be edited here', v_key using errcode = '22023';
    end if;

    if v_f.kind = 'text[]' then
      if jsonb_typeof(p_changes -> v_key) <> 'array' then
        raise exception '% must be a list', v_key using errcode = '22023';
      end if;
      if jsonb_array_length(p_changes -> v_key) not between v_f.min_value and v_f.max_value then
        raise exception '% needs between % and % entries', v_key, v_f.min_value, v_f.max_value
          using errcode = '22023';
      end if;
      for v_q in select jsonb_array_elements_text(p_changes -> v_key) loop
        if length(trim(v_q)) = 0 or length(v_q) > 100 then
          raise exception 'each suggestion must be 1 to 100 characters' using errcode = '22023';
        end if;
      end loop;
    else
      if jsonb_typeof(p_changes -> v_key) <> 'number' then
        raise exception '% must be a number', v_key using errcode = '22023';
      end if;
      v_num := (p_changes ->> v_key)::numeric;
      if v_f.kind = 'integer' and v_num <> trunc(v_num) then
        raise exception '% must be a whole number', v_key using errcode = '22023';
      end if;
      if v_num < v_f.min_value or v_num > v_f.max_value then
        raise exception '% must be between % and %', v_key, v_f.min_value, v_f.max_value
          using errcode = '22023';
      end if;
    end if;
  end loop;

  select * into v_cur from public.search_config where id = 1;
  v_next := jsonb_populate_record(v_cur, p_changes);
  v_next.suggestion_queries := array(select trim(x) from unnest(v_next.suggestion_queries) x);

  -- ts_headline rejects MinWords >= MaxWords, which would break every search.
  if v_next.snippet_min_words >= v_next.snippet_max_words then
    raise exception 'snippet_min_words must be less than snippet_max_words' using errcode = '22023';
  end if;
  return v_next;
end;
$$;

-- Writes a validated row (shared by update and preview). Keeps the suggestion rotation index
-- inside the (possibly shorter) list.
create or replace function admin._search_config_write(p_next public.search_config)
returns public.search_config
language sql
volatile
security definer
set search_path = ''
as $$
  update public.search_config c set
    weight_fts                     = p_next.weight_fts,
    weight_trgm                    = p_next.weight_trgm,
    weight_vector                  = p_next.weight_vector,
    weight_pop                     = p_next.weight_pop,
    pop_wishlist_weight            = p_next.pop_wishlist_weight,
    pop_sale_weight                = p_next.pop_sale_weight,
    pop_log_divisor                = p_next.pop_log_divisor,
    trgm_word_similarity_threshold = p_next.trgm_word_similarity_threshold,
    min_score                      = p_next.min_score,
    snippet_max_words              = p_next.snippet_max_words,
    snippet_min_words              = p_next.snippet_min_words,
    snippet_max_fragments          = p_next.snippet_max_fragments,
    prefetch_threshold_ms          = p_next.prefetch_threshold_ms,
    suggestion_queries             = p_next.suggestion_queries,
    suggestion_query_idx           = c.suggestion_query_idx
                                       % greatest(cardinality(p_next.suggestion_queries), 1),
    updated_at                     = now()
  where c.id = 1
  returning c.*;
$$;

revoke all on function admin._search_config_fields() from public, anon, authenticated;
revoke all on function admin._search_config_next(jsonb) from public, anon, authenticated;
revoke all on function admin._search_config_write(public.search_config) from public, anon, authenticated;

-- ── Console RPCs ───────────────────────────────────────────────────────────────────────────────

create or replace function admin.search_config_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin._require_role('ops');
  return jsonb_build_object(
    'config', (select to_jsonb(c) from public.search_config c where c.id = 1),
    'fields', (select jsonb_agg(jsonb_build_object('field', f.field, 'kind', f.kind,
                                                   'min', f.min_value, 'max', f.max_value))
                 from admin._search_config_fields() f),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'created_at', a.created_at, 'actor_email', a.actor_email,
               'before', a.before, 'after', a.after) order by a.created_at desc)
        from (select * from admin.audit_log
               where action = 'search_config.update'
               order by created_at desc limit 20) a), '[]'::jsonb)
  );
end;
$$;

-- Applies p_changes (only the keys given) and audits just the fields that changed, with the
-- optional reason. Returns the new row.
create or replace function admin.update_search_config(p_changes jsonb, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_next   public.search_config;
  v_diff_b jsonb;
  v_diff_a jsonb;
begin
  perform admin._require_role('ops');
  select to_jsonb(c) into v_before from public.search_config c where c.id = 1 for update;
  v_next := admin._search_config_next(p_changes);
  v_after := to_jsonb(admin._search_config_write(v_next));

  select coalesce(jsonb_object_agg(k, v_before -> k), '{}'::jsonb),
         coalesce(jsonb_object_agg(k, v_after -> k), '{}'::jsonb)
    into v_diff_b, v_diff_a
    from jsonb_object_keys(p_changes) k
   where v_before -> k is distinct from v_after -> k;

  if v_diff_a <> '{}'::jsonb then
    if nullif(trim(p_reason), '') is not null then
      v_diff_a := v_diff_a || jsonb_build_object('reason', left(trim(p_reason), 500));
    end if;
    perform admin._audit('search_config.update', 'search_config', '1', v_diff_b, v_diff_a);
  end if;
  return v_after;
end;
$$;

-- Ranks p_query with the current values and with p_changes applied, without saving: the
-- proposed run happens in a subtransaction that is always rolled back (PL/pgSQL variables keep
-- their values across the rollback). Each row carries its rank in the other list (null when it
-- dropped out), so the console can show movement.
create or replace function admin.preview_search_config(p_query text, p_changes jsonb,
                                                       p_limit int default 20)
returns jsonb
language plpgsql
volatile
security definer
-- search_cards_blended has no search_path of its own and calls pg_trgm's similarity() unqualified,
-- so it needs pg_trgm's schema on the path (public locally, extensions on hosted projects).
-- Everything in this function is schema-qualified.
set search_path = pg_catalog, extensions, public
as $$
declare
  v_limit    int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_next     public.search_config;
  v_current  jsonb;
  v_proposed jsonb;
begin
  perform admin._require_role('ops');
  if nullif(trim(p_query), '') is null then
    raise exception 'enter a search query to preview' using errcode = '22023';
  end if;
  v_next := admin._search_config_next(coalesce(p_changes, '{}'::jsonb));

  select coalesce(jsonb_agg(to_jsonb(r) order by r.rank), '[]'::jsonb) into v_current
    from (select row_number() over (order by s.score desc) as rank,
                 s.id, s.name, s.set_name, round(s.score, 4) as score, s.reason
            from public.search_cards_blended(p_query, v_limit) s) r;

  begin
    perform admin._search_config_write(v_next);
    select coalesce(jsonb_agg(to_jsonb(r) order by r.rank), '[]'::jsonb) into v_proposed
      from (select row_number() over (order by s.score desc) as rank,
                   s.id, s.name, s.set_name, round(s.score, 4) as score, s.reason
              from public.search_cards_blended(p_query, v_limit) s) r;
    raise exception 'preview rollback' using errcode = 'ZZ057';
  exception when sqlstate 'ZZ057' then
    null;
  end;

  return jsonb_build_object(
    'query', p_query,
    'current', (select coalesce(jsonb_agg(c || jsonb_build_object('other_rank',
                  (select p ->> 'rank' from jsonb_array_elements(v_proposed) p
                    where p ->> 'id' = c ->> 'id')::int) order by (c ->> 'rank')::int), '[]'::jsonb)
                  from jsonb_array_elements(v_current) c),
    'proposed', (select coalesce(jsonb_agg(p || jsonb_build_object('other_rank',
                  (select c ->> 'rank' from jsonb_array_elements(v_current) c
                    where c ->> 'id' = p ->> 'id')::int) order by (p ->> 'rank')::int), '[]'::jsonb)
                  from jsonb_array_elements(v_proposed) p)
  );
end;
$$;

revoke all on function admin.search_config_get() from public, anon;
revoke all on function admin.update_search_config(jsonb, text) from public, anon;
revoke all on function admin.preview_search_config(text, jsonb, int) from public, anon;
grant execute on function admin.search_config_get() to authenticated, service_role;
grant execute on function admin.update_search_config(jsonb, text) to authenticated, service_role;
grant execute on function admin.preview_search_config(text, jsonb, int) to authenticated, service_role;
