-- ITS-191: promo boxes — admin-authored home feed cards (product releases, announcements).
--
-- An editor builds a promo from a template in the Retool admin console (ITS-193); the app renders
-- live ones on the home feed (ITS-192). All writes go through admin.* RPCs that check the
-- caller's role and write admin.audit_log, like the rest of the admin schema (ITS-116).
--
--   admin.upsert_promo ──▶ admin.promos (+ admin.promo_revisions snapshot)
--                      └─▶ (if published) marketplace_section_meta 'promo_<id>' kind='custom'
--   marketplace-feed-refresh (ITS-97, every 5 min) fills that section's cards
--   public.get_active_promos(placement) ──▶ live promos + mode + cards from the section cache
--
-- Which cards a promo covers reuses the ITS-97 feed vocabulary (filter + order_by), so "See all"
-- and the rail are the same cached feed and there is no new refresh code. Two keys are added to
-- the vocabulary for that: pin_ref_ids (always included, ranked first) and exclude_ref_ids.
--
-- Status is the admin's intent (draft / published / archived). Scheduled / live / ended are
-- derived from starts_at / ends_at at read time (admin._promo_phase), so no cron flips states.
--
-- mode, returned to the app:
--   announcement  the promo covers no cards (an announcement with no card criteria)
--   coming_soon   release_date hasn't passed, or fewer than min_cards matching listings yet
--   cards         otherwise; items are the section's cached listings

-- ── 1. Feed vocabulary: pin_ref_ids / exclude_ref_ids ──────────────────────────────────────
-- Bodies verbatim from 20261104000001 apart from the two new keys.

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
    "release_year_min": "int", "release_year_max": "int", "listed_within_days": "int",
    "pin_ref_ids": "uuid[]", "exclude_ref_ids": "uuid[]"
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
      (select array_agg(lower(x)) from jsonb_array_elements_text(f -> 'grading_companies') x) as companies,
      coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(f -> 'pin_ref_ids') x), '{}')     as pins,
      coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(f -> 'exclude_ref_ids') x), '{}') as excl
  ),
  matched as (
    select b.*, array_position(arr.pins, b.ref_id) as pin_pos
      from public._marketplace_base_listings() b
      cross join arr
      left join public.cards c on c.id = b.ref_id
     where (b.ref_id is null or not (b.ref_id = any (arr.excl)))
       and (
            b.ref_id = any (arr.pins)
         or (    (arr.genres     is null or lower(b.genre) = any (arr.genres))
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
            )
       )
  ),
  ranked as (
    select m.*,
           row_number() over (
             order by
               m.pin_pos asc nulls last,
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
         to_jsonb(r) - 'rn' - 'pin_pos'
    from ranked r
   where r.rn <= greatest(coalesce(p_limit, 20), 0)
   order by r.rn;
end;
$$;

-- ── 2. Promo sections stay off the marketplace screen ──────────────────────────────────────

alter table public.marketplace_section_meta
  add column if not exists show_in_marketplace boolean not null default true;

-- Body verbatim from 20260721000000 apart from the show_in_marketplace filter.
create or replace function public.get_marketplace_sections()
returns table (
  section_key   text,
  title         text,
  sort_order    int,
  refreshed_at  timestamptz,
  items         jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.marketplace_section_items) then
    perform public.refresh_marketplace_sections();
  end if;

  return query
    select m.key, m.title, m.sort_order, m.refreshed_at,
           coalesce(
             (select jsonb_agg(i.payload order by i.rank)
                from public.marketplace_section_items i
               where i.section_key = m.key),
             '[]'::jsonb
           )
    from public.marketplace_section_meta m
    where m.enabled and m.show_in_marketplace
    order by m.sort_order;
end;
$$;

-- ── 3. Tables ──────────────────────────────────────────────────────────────────────────────

create table if not exists admin.promos (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique
                   check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  template         text not null check (template in ('product_release', 'announcement')),

  -- Copy
  title            text not null check (char_length(btrim(title)) between 1 and 80),
  subtitle         text check (char_length(subtitle) <= 120),
  body             text check (char_length(body) <= 500),
  badge            text check (badge in ('new', 'coming_soon', 'hot')),
  -- Object path inside the promo-assets bucket, never a URL.
  hero_image_path  text check (hero_image_path ~ '^[A-Za-z0-9][A-Za-z0-9/_.-]{0,255}$'
                               and hero_image_path !~ '\.\.'),
  -- Palette key the client maps to a theme color (same list as collections.accent_color, ITS-98).
  accent           text check (accent in ('violet', 'purple', 'blue', 'cyan', 'green', 'yellow',
                                          'orange', 'red', 'grey')),
  -- { "label": "...", "kind": "see_all" | "route" | "url", "target": "..." } (see admin._promo_errors)
  cta              jsonb,

  -- Which cards it covers (ITS-97 vocabulary; pins/exclusions live in their own columns)
  filter           jsonb not null default '{}'::jsonb
                   check (cardinality(public.marketplace_feed_filter_errors(filter)) = 0
                          and not (filter ? 'pin_ref_ids' or filter ? 'exclude_ref_ids')),
  order_by         text not null default 'popularity'
                   check (order_by in ('popularity', 'value_desc', 'value_asc', 'newest')),
  pinned_ref_ids   uuid[] not null default '{}',
  excluded_ref_ids uuid[] not null default '{}',
  -- Below this many matching listings the promo stays in coming_soon mode.
  min_cards        int not null default 4 check (min_cards between 0 and 50),

  -- Where and when
  placement        text not null default 'home_rail' check (placement in ('home_hero', 'home_rail')),
  priority         int not null default 0 check (priority between -1000 and 1000),
  release_date     timestamptz,
  starts_at        timestamptz,
  ends_at          timestamptz,
  constraint promos_window_check check (starts_at is null or ends_at is null or ends_at > starts_at),

  status           text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at     timestamptz,
  revision         int not null default 1,

  created_by       uuid references auth.users (id) on delete set null,
  updated_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists promos_live_idx on admin.promos (placement, priority desc)
  where status = 'published';
create index if not exists promos_created_by_idx on admin.promos (created_by);
create index if not exists promos_updated_by_idx on admin.promos (updated_by);

-- One full snapshot of the editable fields per save, for history and rollback.
create table if not exists admin.promo_revisions (
  id          bigint generated always as identity primary key,
  promo_id    uuid not null references admin.promos (id) on delete cascade,
  revision    int  not null,
  snapshot    jsonb not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (promo_id, revision)
);
create index if not exists promo_revisions_created_by_idx on admin.promo_revisions (created_by);

-- Draft preview links for the app (ITS-192). Only a hash of the token is stored.
create table if not exists admin.promo_preview_tokens (
  token_hash  text primary key,
  promo_id    uuid not null references admin.promos (id) on delete cascade,
  expires_at  timestamptz not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists promo_preview_tokens_promo_idx on admin.promo_preview_tokens (promo_id);
create index if not exists promo_preview_tokens_created_by_idx on admin.promo_preview_tokens (created_by);

alter table admin.promos               enable row level security;
alter table admin.promo_revisions      enable row level security;
alter table admin.promo_preview_tokens enable row level security;

revoke all on admin.promos, admin.promo_revisions, admin.promo_preview_tokens
  from public, anon, authenticated;
grant all on admin.promos, admin.promo_revisions, admin.promo_preview_tokens to service_role;
grant usage, select on sequence admin.promo_revisions_id_seq to service_role;

-- ── 4. Internal helpers (not client-executable) ────────────────────────────────────────────

-- The editable fields, as stored in a revision and accepted by upsert_promo.
create or replace function admin._promo_editable_keys()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['slug', 'template', 'title', 'subtitle', 'body', 'badge', 'hero_image_path',
               'accent', 'cta', 'filter', 'order_by', 'pinned_ref_ids', 'excluded_ref_ids',
               'min_cards', 'placement', 'priority', 'release_date', 'starts_at', 'ends_at'];
$$;

create or replace function admin._promo_snapshot(p admin.promos)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_object_agg(e.key, e.value)
    from jsonb_each(to_jsonb(p)) e
   where e.key = any (admin._promo_editable_keys());
$$;

create or replace function admin._promo_section_key(p_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$ select 'promo_' || replace(p_id::text, '-', '') $$;

-- The feed filter the promo's section uses: its filter plus pins and exclusions.
create or replace function admin._promo_feed_filter(p admin.promos)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select p.filter
         || case when cardinality(p.pinned_ref_ids) > 0
                 then jsonb_build_object('pin_ref_ids', to_jsonb(p.pinned_ref_ids)) else '{}' end
         || case when cardinality(p.excluded_ref_ids) > 0
                 then jsonb_build_object('exclude_ref_ids', to_jsonb(p.excluded_ref_ids)) else '{}' end;
$$;

-- Product releases always cover cards; an announcement only if it has card criteria.
create or replace function admin._promo_has_cards(p admin.promos)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p.template = 'product_release' or p.filter <> '{}'::jsonb or cardinality(p.pinned_ref_ids) > 0;
$$;

create or replace function admin._promo_phase(p admin.promos)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p.status = 'archived' then 'archived'
    when p.status = 'draft' then 'draft'
    when p.ends_at is not null and p.ends_at <= now() then 'ended'
    when p.starts_at is not null and p.starts_at > now() then 'scheduled'
    else 'live'
  end;
$$;

create or replace function admin._promo_mode(p admin.promos, p_item_count int)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when not admin._promo_has_cards(p) then 'announcement'
    when (p.release_date is null or p.release_date <= now()) and p_item_count >= p.min_cards then 'cards'
    else 'coming_soon'
  end;
$$;

-- Template rules on top of the table's checks. Returns every problem at once for the editor.
create or replace function admin._promo_errors(p admin.promos)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_errors text[] := '{}';
  v_kind   text := p.cta ->> 'kind';
  v_target text := p.cta ->> 'target';
begin
  if p.template = 'product_release' then
    if jsonb_typeof(p.filter -> 'sets') is distinct from 'array' or jsonb_array_length(p.filter -> 'sets') = 0 then
      v_errors := v_errors || 'a product release needs at least one set'::text;
    end if;
    if p.release_date is null then
      v_errors := v_errors || 'a product release needs a release date'::text;
    end if;
  end if;

  if p.cta is not null then
    if jsonb_typeof(p.cta) <> 'object' then
      v_errors := v_errors || 'cta must be {label, kind, target}'::text;
    elsif exists (select 1 from jsonb_object_keys(p.cta) k where k not in ('label', 'kind', 'target')) then
      v_errors := v_errors || 'cta must be {label, kind, target}'::text;
    elsif char_length(btrim(coalesce(p.cta ->> 'label', ''))) not between 1 and 30 then
      v_errors := v_errors || 'cta label must be 1-30 characters'::text;
    elsif v_kind = 'see_all' then
      if not admin._promo_has_cards(p) then
        v_errors := v_errors || 'a "see all" button needs card criteria'::text;
      end if;
    elsif v_kind = 'route' then
      if v_target is null or v_target !~ '^/[A-Za-z0-9/_\-\[\]?=&.%]*$' then
        v_errors := v_errors || 'a route button needs an app path starting with /'::text;
      end if;
    elsif v_kind = 'url' then
      if v_target is null or v_target !~ '^https://[^\s]+$' then
        v_errors := v_errors || 'a link button needs an https:// URL'::text;
      end if;
    else
      v_errors := v_errors || 'cta kind must be see_all, route or url'::text;
    end if;
  end if;

  return v_errors;
end;
$$;

-- Keeps the promo's marketplace section in step with the promo. Published promos that cover
-- cards get an enabled custom section (hidden from the marketplace screen); anything else
-- disables it. expires_at is cleared so the next feed refresh (≤5 min) recomputes it.
create or replace function admin._sync_promo_section(p admin.promos)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := admin._promo_section_key(p.id);
begin
  if p.status = 'published' and admin._promo_has_cards(p) then
    insert into public.marketplace_section_meta
      (key, title, enabled, sort_order, result_limit, refresh_interval, kind, filter, order_by,
       show_in_marketplace, expires_at, updated_at)
    values
      (v_key, p.title, true, 1000, 50, '30 minutes', 'custom', admin._promo_feed_filter(p), p.order_by,
       false, null, now())
    on conflict (key) do update
      set title = excluded.title, enabled = true, filter = excluded.filter,
          order_by = excluded.order_by, show_in_marketplace = false,
          expires_at = null, updated_at = now();
  else
    update public.marketplace_section_meta
       set enabled = false, updated_at = now()
     where key = v_key and enabled;
  end if;
end;
$$;

create or replace function admin._promo_json(p admin.promos)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(p)
         || jsonb_build_object(
              'phase', admin._promo_phase(p),
              'section_key', case when admin._promo_has_cards(p) then admin._promo_section_key(p.id) end,
              'created_by_email', (select u.email from auth.users u where u.id = p.created_by),
              'updated_by_email', (select u.email from auth.users u where u.id = p.updated_by));
$$;

-- Validates and writes one promo from a payload of editable fields. Shared by upsert_promo and
-- restore_promo_revision. p_expected_revision guards against overwriting someone else's save.
create or replace function admin._save_promo(
  p_id uuid, p_fields jsonb, p_expected_revision int, p_actor uuid, p_action text
)
returns admin.promos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old     admin.promos;
  v_new     admin.promos;
  v_unknown text[];
  v_errors  text[];
  v_base    text;
begin
  select array_agg(k) into v_unknown
    from jsonb_object_keys(p_fields) k
   where k <> all (admin._promo_editable_keys());
  if v_unknown is not null then
    raise exception 'unknown promo field(s): %', array_to_string(v_unknown, ', ') using errcode = '22023';
  end if;

  if p_id is not null then
    select * into v_old from admin.promos where id = p_id for update;
    if not found then
      raise exception 'promo % not found', p_id using errcode = 'P0002';
    end if;
    if p_expected_revision is not null and p_expected_revision <> v_old.revision then
      raise exception 'this promo was changed by someone else (revision % → %); reload and try again',
        p_expected_revision, v_old.revision using errcode = '40001';
    end if;
    v_new := v_old;
  else
    v_new := row(gen_random_uuid(), null, null, null, null, null, null, null, null, null,
                 '{}'::jsonb, 'popularity', '{}'::uuid[], '{}'::uuid[], 4,
                 'home_rail', 0, null, null, null,
                 'draft', null, 0, p_actor, p_actor, now(), now())::admin.promos;
  end if;

  begin
    v_new := jsonb_populate_record(v_new, p_fields);
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
                 or numeric_value_out_of_range or invalid_parameter_value then
    raise exception 'invalid promo field value: %', sqlerrm using errcode = '22023';
  end;

  -- Defaults that need other fields.
  if v_new.template is null then
    raise exception 'template is required (product_release or announcement)' using errcode = '22023';
  end if;
  if v_new.title is null or btrim(v_new.title) = '' then
    raise exception 'title is required' using errcode = '22023';
  end if;
  v_new.title := btrim(v_new.title);
  if v_new.slug is null or btrim(v_new.slug) = '' then
    v_base := left(trim(both '-' from regexp_replace(lower(v_new.title), '[^a-z0-9]+', '-', 'g')), 56);
    if v_base = '' then v_base := 'promo'; end if;
    v_new.slug := v_base;
    while exists (select 1 from admin.promos where slug = v_new.slug and id <> v_new.id) loop
      v_new.slug := v_base || '-' || substr(md5(random()::text), 1, 4);
    end loop;
  end if;
  v_new.filter           := coalesce(v_new.filter, '{}'::jsonb);
  v_new.pinned_ref_ids   := coalesce(v_new.pinned_ref_ids, '{}');
  v_new.excluded_ref_ids := coalesce(v_new.excluded_ref_ids, '{}');
  v_new.order_by         := coalesce(v_new.order_by, 'popularity');
  v_new.placement        := coalesce(v_new.placement, 'home_rail');
  v_new.priority         := coalesce(v_new.priority, 0);
  v_new.min_cards        := coalesce(v_new.min_cards, 4);

  v_errors := admin._promo_errors(v_new)
              || public.marketplace_feed_filter_errors(v_new.filter);
  if cardinality(v_errors) > 0 then
    raise exception '%', array_to_string(v_errors, '; ') using errcode = '22023';
  end if;

  v_new.revision   := coalesce(v_old.revision, 0) + 1;
  v_new.updated_by := p_actor;
  v_new.updated_at := now();

  begin
    if v_old.id is null then
      insert into admin.promos select v_new.*;
    else
      update admin.promos set
        slug = v_new.slug, template = v_new.template, title = v_new.title, subtitle = v_new.subtitle,
        body = v_new.body, badge = v_new.badge, hero_image_path = v_new.hero_image_path,
        accent = v_new.accent, cta = v_new.cta, filter = v_new.filter, order_by = v_new.order_by,
        pinned_ref_ids = v_new.pinned_ref_ids, excluded_ref_ids = v_new.excluded_ref_ids,
        min_cards = v_new.min_cards, placement = v_new.placement, priority = v_new.priority,
        release_date = v_new.release_date, starts_at = v_new.starts_at, ends_at = v_new.ends_at,
        revision = v_new.revision, updated_by = v_new.updated_by, updated_at = v_new.updated_at
      where id = v_new.id;
    end if;
  exception
    when unique_violation then
      raise exception 'slug "%" is already used by another promo', v_new.slug using errcode = '22023';
    when check_violation or not_null_violation then
      raise exception 'invalid promo: %', sqlerrm using errcode = '22023';
  end;

  insert into admin.promo_revisions (promo_id, revision, snapshot, created_by)
  values (v_new.id, v_new.revision, admin._promo_snapshot(v_new), p_actor);

  perform admin._sync_promo_section(v_new);
  perform admin._audit(p_action, 'promo', v_new.id::text,
                       case when v_old.id is not null then admin._promo_snapshot(v_old) end,
                       admin._promo_snapshot(v_new));
  return v_new;
end;
$$;

-- ── 5. Admin RPCs ──────────────────────────────────────────────────────────────────────────

-- Create (no "id") or update (with "id") a promo. Payload: any editable fields, plus optional
-- "revision" (the revision the editor loaded; a mismatch raises 40001). Returns the saved promo.
create or replace function admin.upsert_promo(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := admin._require_role('editor');
  v_id    uuid;
  v_rev   int;
  v_saved admin.promos;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'payload must be a JSON object' using errcode = '22023';
  end if;
  begin
    v_id  := (p_payload ->> 'id')::uuid;
    v_rev := (p_payload ->> 'revision')::int;
  exception when invalid_text_representation then
    raise exception 'id must be a UUID and revision an integer' using errcode = '22023';
  end;

  v_saved := admin._save_promo(v_id, p_payload - 'id' - 'revision', v_rev, v_actor,
                               case when v_id is null then 'promo.create' else 'promo.update' end);
  return admin._promo_json(v_saved);
end;
$$;

-- Live match preview for the editor: how many current listings the criteria match, plus a sample
-- in the order the rail would show them. Count stops at 1000 (count_capped = true).
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
                    order by m.rank) filter (where m.rank <= least(greatest(p_limit, 0), 50)), '[]'::jsonb)
    into v_count, v_sample
    from m;

  return jsonb_build_object('count', least(v_count, 1000), 'count_capped', v_count > 1000, 'sample', v_sample);
end;
$$;

-- draft (unpublish), published (publish now, or scheduled when starts_at is in the future),
-- archived. Publishing re-validates and turns on the promo's card section.
create or replace function admin.set_promo_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := admin._require_role('editor');
  v_old    admin.promos;
  v_new    admin.promos;
  v_errors text[];
begin
  if p_status not in ('draft', 'published', 'archived') then
    raise exception 'status must be draft, published or archived' using errcode = '22023';
  end if;
  select * into v_old from admin.promos where id = p_id for update;
  if not found then
    raise exception 'promo % not found', p_id using errcode = 'P0002';
  end if;

  v_new := v_old;
  v_new.status := p_status;
  if p_status = 'published' then
    v_errors := admin._promo_errors(v_new);
    if cardinality(v_errors) > 0 then
      raise exception '%', array_to_string(v_errors, '; ') using errcode = '22023';
    end if;
    if v_old.status <> 'published' then
      v_new.published_at := now();
    end if;
  end if;

  update admin.promos
     set status = v_new.status, published_at = v_new.published_at,
         updated_by = v_actor, updated_at = now()
   where id = p_id
  returning * into v_new;

  perform admin._sync_promo_section(v_new);
  perform admin._audit('promo.set_status', 'promo', p_id::text,
                       jsonb_build_object('status', v_old.status), jsonb_build_object('status', v_new.status));
  return admin._promo_json(v_new);
end;
$$;

create or replace function admin.list_promos(p_include_archived boolean default false)
returns table (
  id uuid, slug text, template text, title text, placement text, priority int,
  status text, phase text, release_date timestamptz, starts_at timestamptz, ends_at timestamptz,
  revision int, updated_at timestamptz, updated_by_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin._require_role('editor');
  return query
    select p.id, p.slug, p.template, p.title, p.placement, p.priority,
           p.status, admin._promo_phase(p), p.release_date, p.starts_at, p.ends_at,
           p.revision, p.updated_at, u.email::text
      from admin.promos p
      left join auth.users u on u.id = p.updated_by
     where p_include_archived or p.status <> 'archived'
     order by (p.status = 'published') desc, p.priority desc, p.updated_at desc;
end;
$$;

-- One promo with its revision history (newest first, without snapshots).
create or replace function admin.get_promo(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_promo admin.promos;
begin
  perform admin._require_role('editor');
  select * into v_promo from admin.promos where id = p_id;
  if not found then
    raise exception 'promo % not found', p_id using errcode = 'P0002';
  end if;
  return admin._promo_json(v_promo)
         || jsonb_build_object('revisions', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'id', r.id, 'revision', r.revision, 'created_at', r.created_at,
                       'created_by_email', u.email) order by r.revision desc)
                from admin.promo_revisions r
                left join auth.users u on u.id = r.created_by
               where r.promo_id = p_id), '[]'::jsonb));
end;
$$;

-- Restores a revision's content as a new revision. Status is left as it is.
create or replace function admin.restore_promo_revision(p_revision_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := admin._require_role('editor');
  v_rev   admin.promo_revisions;
  v_saved admin.promos;
begin
  select * into v_rev from admin.promo_revisions where id = p_revision_id;
  if not found then
    raise exception 'revision % not found', p_revision_id using errcode = 'P0002';
  end if;
  v_saved := admin._save_promo(v_rev.promo_id, v_rev.snapshot, null, v_actor, 'promo.restore');
  return admin._promo_json(v_saved) || jsonb_build_object('restored_from_revision', v_rev.revision);
end;
$$;

-- A link token for previewing a promo (any status) in the app. Returned once; only its hash is
-- stored. Default lifetime 24 hours, max 7 days.
create or replace function admin.issue_preview_token(p_promo_id uuid, p_ttl_minutes int default 1440)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid := admin._require_role('editor');
  v_token   text := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires timestamptz := now() + make_interval(mins => least(greatest(coalesce(p_ttl_minutes, 1440), 5), 10080));
begin
  if not exists (select 1 from admin.promos where id = p_promo_id) then
    raise exception 'promo % not found', p_promo_id using errcode = 'P0002';
  end if;
  delete from admin.promo_preview_tokens where expires_at < now();
  insert into admin.promo_preview_tokens (token_hash, promo_id, expires_at, created_by)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), p_promo_id, v_expires, v_actor);
  perform admin._audit('promo.preview_token', 'promo', p_promo_id::text, null,
                       jsonb_build_object('expires_at', v_expires));
  return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end;
$$;

-- ── 6. Public read RPCs (the app) ──────────────────────────────────────────────────────────

-- Live promos for a placement (or all), highest priority first. Drafts, archived promos and
-- promos outside their schedule are never returned.
create or replace function public.get_active_promos(p_placement text default null)
returns table (
  id uuid, slug text, template text, placement text, priority int,
  title text, subtitle text, body text, badge text, hero_image_path text, accent text, cta jsonb,
  release_date timestamptz, ends_at timestamptz, section_key text, mode text, item_count int, items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with live as (
    select p, admin._promo_section_key(p.id) as key
      from admin.promos p
     where p.status = 'published'
       and (p.starts_at is null or p.starts_at <= now())
       and (p.ends_at is null or p.ends_at > now())
       and (p_placement is null or p.placement = p_placement)
  ),
  withitems as (
    select l.p, l.key,
           coalesce(s.items, '[]'::jsonb) as items,
           coalesce(jsonb_array_length(s.items), 0) as n
      from live l
      left join lateral (
        select jsonb_agg(i.payload order by i.rank) as items
          from public.marketplace_section_items i
          join public.marketplace_section_meta m on m.key = i.section_key and m.enabled
         where i.section_key = l.key
      ) s on admin._promo_has_cards(l.p)
  )
  select (w.p).id, (w.p).slug, (w.p).template, (w.p).placement, (w.p).priority,
         (w.p).title, (w.p).subtitle, (w.p).body, (w.p).badge, (w.p).hero_image_path, (w.p).accent, (w.p).cta,
         (w.p).release_date, (w.p).ends_at,
         case when admin._promo_has_cards(w.p) then w.key end,
         admin._promo_mode(w.p, w.n),
         w.n,
         case when admin._promo_mode(w.p, w.n) = 'cards' then w.items else '[]'::jsonb end
    from withitems w
   order by (w.p).priority desc, (w.p).published_at desc nulls last, (w.p).id;
$$;

-- The same shape for one promo, any status, from a preview token (admin.issue_preview_token).
-- Cards are computed live because drafts have no cached section. Returns no row for an unknown
-- or expired token.
create or replace function public.get_promo_preview(p_token text)
returns table (
  id uuid, slug text, template text, placement text, priority int,
  title text, subtitle text, body text, badge text, hero_image_path text, accent text, cta jsonb,
  release_date timestamptz, ends_at timestamptz, section_key text, mode text, item_count int, items jsonb,
  status text, phase text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_p     admin.promos;
  v_items jsonb := '[]'::jsonb;
  v_n     int := 0;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return;
  end if;
  select p.* into v_p
    from admin.promo_preview_tokens t
    join admin.promos p on p.id = t.promo_id
   where t.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and t.expires_at > now();
  if not found then
    return;
  end if;

  if admin._promo_has_cards(v_p) then
    select coalesce(jsonb_agg(f.payload order by f.rank), '[]'::jsonb), count(*)::int
      into v_items, v_n
      from public.marketplace_feed_listings(admin._promo_feed_filter(v_p), v_p.order_by, 50) f;
  end if;

  return query select
    v_p.id, v_p.slug, v_p.template, v_p.placement, v_p.priority,
    v_p.title, v_p.subtitle, v_p.body, v_p.badge, v_p.hero_image_path, v_p.accent, v_p.cta,
    v_p.release_date, v_p.ends_at,
    case when admin._promo_has_cards(v_p) then admin._promo_section_key(v_p.id) end,
    admin._promo_mode(v_p, v_n), v_n,
    case when admin._promo_mode(v_p, v_n) = 'cards' then v_items else '[]'::jsonb end,
    v_p.status, admin._promo_phase(v_p);
end;
$$;

-- ── 7. Storage: promo-assets (public read; editors write) ──────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promo-assets', 'promo-assets', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "promo-assets: editors insert" on storage.objects;
create policy "promo-assets: editors insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'promo-assets' and (select admin.has_role('editor')));

drop policy if exists "promo-assets: editors update" on storage.objects;
create policy "promo-assets: editors update"
  on storage.objects for update to authenticated
  using (bucket_id = 'promo-assets' and (select admin.has_role('editor')))
  with check (bucket_id = 'promo-assets' and (select admin.has_role('editor')));

drop policy if exists "promo-assets: editors delete" on storage.objects;
create policy "promo-assets: editors delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'promo-assets' and (select admin.has_role('editor')));

-- ── 8. Grants ──────────────────────────────────────────────────────────────────────────────

revoke all on all functions in schema admin from public, anon, authenticated;

grant execute on function admin.has_role(text[])                    to authenticated;
grant execute on function admin.whoami()                            to authenticated;
grant execute on function admin.list_members()                      to authenticated;
grant execute on function admin.set_member_role(text, text)         to authenticated;
grant execute on function admin.remove_member(uuid)                 to authenticated;
grant execute on function admin.list_audit_log(int, bigint, text)   to authenticated;

grant execute on function admin.upsert_promo(jsonb)                                   to authenticated;
grant execute on function admin.preview_promo_matches(jsonb, text, uuid[], uuid[], int) to authenticated;
grant execute on function admin.set_promo_status(uuid, text)                          to authenticated;
grant execute on function admin.list_promos(boolean)                                  to authenticated;
grant execute on function admin.get_promo(uuid)                                       to authenticated;
grant execute on function admin.restore_promo_revision(bigint)                        to authenticated;
grant execute on function admin.issue_preview_token(uuid, int)                        to authenticated;

grant execute on all functions in schema admin to service_role;

revoke all on function public.get_active_promos(text) from public;
revoke all on function public.get_promo_preview(text) from public;
grant execute on function public.get_active_promos(text) to anon, authenticated, service_role;
grant execute on function public.get_promo_preview(text) to anon, authenticated, service_role;
