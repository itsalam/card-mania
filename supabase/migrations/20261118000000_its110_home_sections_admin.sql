-- ITS-110: edit the Home feed sections (public.home_feed_section_meta) from the admin console.
--
--   admin.list_home_sections()                 every row, enabled or not, in display order
--   admin.update_home_section(key, patch)      title, icon, enabled, result_limit and layout
--   admin.reorder_home_sections(keys)          new display order for every section
--
-- All three need the editor role (owner always passes); the two writes add an audit_log row.
-- Sections can't be created or deleted here: each key maps to a reviewed, RLS-scoped query in
-- the app (features/home/FeedPage.tsx), so a new key needs an app release anyway.
--
-- The app reads the table through public.get_home_feed_sections() (enabled rows, by
-- sort_order) with a one-minute cache, so an edit shows up on the next Home refresh.

-- ── Validation ─────────────────────────────────────────────────────────────────────────────────
-- Icon names the app can render: HOME_FEED_SECTION_ICONS in features/home/sectionIcons.ts.
-- Keep the two lists in step; an unknown name falls back to the section's default icon.
create or replace function admin._home_section_icons()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['heart', 'layers', 'users', 'sparkles', 'trending_up', 'clock'] $$;

-- Problems with a row as it would be saved; empty when it's fine.
-- Layout keys (client/home/sections.ts HomeFeedSectionLayout): itemWidth, collapsedWidth,
-- expandedHeight (numbers, in points) and expandable (boolean). collapsedHeight is legacy and
-- ignored by the app, but allowed so older rows still save.
create or replace function admin._home_section_errors(p public.home_feed_section_meta)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_errors text[] := '{}';
  v_key    text;
  v_value  jsonb;
begin
  if p.title is null or length(btrim(p.title)) = 0 then
    v_errors := array_append(v_errors, 'title is required');
  elsif length(p.title) > 40 then
    v_errors := array_append(v_errors, 'title must be 40 characters or fewer');
  end if;

  if p.icon is null or not (p.icon = any (admin._home_section_icons())) then
    v_errors := array_append(v_errors, format('icon must be one of: %s', array_to_string(admin._home_section_icons(), ', ')));
  end if;

  if p.result_limit is null or p.result_limit < 1 or p.result_limit > 50 then
    v_errors := array_append(v_errors, 'result_limit must be between 1 and 50');
  end if;

  if p.layout is null or jsonb_typeof(p.layout) <> 'object' then
    v_errors := array_append(v_errors, 'layout must be an object');
  else
    for v_key, v_value in select e.key, e.value from jsonb_each(p.layout) e loop
      if v_key in ('itemWidth', 'collapsedWidth') then
        if jsonb_typeof(v_value) <> 'number' or v_value::numeric < 40 or v_value::numeric > 400 then
          v_errors := array_append(v_errors, format('layout.%s must be a number from 40 to 400', v_key));
        end if;
      elsif v_key in ('expandedHeight', 'collapsedHeight') then
        if jsonb_typeof(v_value) <> 'number' or v_value::numeric < 60 or v_value::numeric > 800 then
          v_errors := array_append(v_errors, format('layout.%s must be a number from 60 to 800', v_key));
        end if;
      elsif v_key = 'expandable' then
        if jsonb_typeof(v_value) <> 'boolean' then
          v_errors := array_append(v_errors, 'layout.expandable must be true or false');
        end if;
      else
        v_errors := array_append(v_errors, format('layout.%s is not a known layout key', v_key));
      end if;
    end loop;
  end if;

  return v_errors;
end;
$$;

-- ── RPCs ───────────────────────────────────────────────────────────────────────────────────────
create or replace function admin.list_home_sections()
returns table (
  key          text,
  title        text,
  icon         text,
  enabled      boolean,
  sort_order   int,
  result_limit int,
  layout       jsonb,
  updated_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin._require_role('editor');
  return query
    select s.key, s.title, s.icon, s.enabled, s.sort_order, s.result_limit, s.layout, s.updated_at
      from public.home_feed_section_meta s
     order by s.sort_order, s.key;
end;
$$;

-- Applies the given fields (any of title, icon, enabled, result_limit, layout; layout replaces
-- the whole object) and returns the saved row. Pass the row's updated_at as
-- `expected_updated_at` to refuse the save when someone else changed it since it was loaded.
create or replace function admin.update_home_section(p_key text, p_patch jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old    public.home_feed_section_meta;
  v_new    public.home_feed_section_meta;
  v_bad    text[];
  v_errors text[];
begin
  perform admin._require_role('editor');

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be an object' using errcode = '22023';
  end if;
  select array_agg(k) into v_bad
    from jsonb_object_keys(p_patch) k
   where k not in ('title', 'icon', 'enabled', 'result_limit', 'layout', 'expected_updated_at');
  if v_bad is not null then
    raise exception 'unknown fields: %', array_to_string(v_bad, ', ') using errcode = '22023';
  end if;

  select * into v_old from public.home_feed_section_meta s where s.key = p_key for update;
  if not found then
    raise exception 'no home section %', p_key using errcode = 'P0002';
  end if;

  if p_patch ? 'expected_updated_at'
     and (p_patch ->> 'expected_updated_at')::timestamptz is distinct from v_old.updated_at then
    raise exception 'this section was changed by someone else; reload and try again'
      using errcode = '40001';
  end if;

  v_new := v_old;
  if p_patch ? 'title'        then v_new.title        := btrim(p_patch ->> 'title'); end if;
  if p_patch ? 'icon'         then v_new.icon         := p_patch ->> 'icon'; end if;
  if p_patch ? 'enabled'      then
    if jsonb_typeof(p_patch -> 'enabled') <> 'boolean' then
      raise exception 'enabled must be true or false' using errcode = '22023';
    end if;
    v_new.enabled := (p_patch ->> 'enabled')::boolean;
  end if;
  if p_patch ? 'result_limit' then
    if jsonb_typeof(p_patch -> 'result_limit') <> 'number' then
      raise exception 'result_limit must be a number' using errcode = '22023';
    end if;
    v_new.result_limit := (p_patch ->> 'result_limit')::numeric::int;
  end if;
  if p_patch ? 'layout'       then v_new.layout       := p_patch -> 'layout'; end if;

  v_errors := admin._home_section_errors(v_new);
  if cardinality(v_errors) > 0 then
    raise exception '%', array_to_string(v_errors, '; ') using errcode = '22023';
  end if;

  update public.home_feed_section_meta s
     set title = v_new.title, icon = v_new.icon, enabled = v_new.enabled,
         result_limit = v_new.result_limit, layout = v_new.layout, updated_at = now()
   where s.key = p_key
  returning * into v_new;

  perform admin._audit('home_section.update', 'home_section', p_key,
                       to_jsonb(v_old) - 'updated_at', to_jsonb(v_new) - 'updated_at');
  return to_jsonb(v_new);
end;
$$;

-- Sets the display order to the given keys, which must name every section exactly once.
-- Returns the sections in their new order.
create or replace function admin.reorder_home_sections(p_keys text[])
returns setof jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  perform admin._require_role('editor');

  if p_keys is null
     or cardinality(p_keys) <> (select count(*) from public.home_feed_section_meta)
     or cardinality(p_keys) <> (select count(distinct k) from unnest(p_keys) k)
     or exists (select 1 from unnest(p_keys) k
                 where not exists (select 1 from public.home_feed_section_meta s where s.key = k)) then
    raise exception 'keys must list every home section exactly once' using errcode = '22023';
  end if;

  select jsonb_agg(s.key order by s.sort_order, s.key) into v_before
    from public.home_feed_section_meta s;

  update public.home_feed_section_meta s
     set sort_order = o.ord::int - 1, updated_at = now()
    from unnest(p_keys) with ordinality o(key, ord)
   where s.key = o.key and s.sort_order is distinct from o.ord::int - 1;

  perform admin._audit('home_section.reorder', 'home_section', null,
                       jsonb_build_object('order', v_before), jsonb_build_object('order', to_jsonb(p_keys)));

  return query
    select to_jsonb(s) from public.home_feed_section_meta s order by s.sort_order, s.key;
end;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────────────────────────
revoke all on function admin._home_section_icons()                                   from public, anon, authenticated;
revoke all on function admin._home_section_errors(public.home_feed_section_meta)      from public, anon, authenticated;
revoke all on function admin.list_home_sections()                                    from public, anon;
revoke all on function admin.update_home_section(text, jsonb)                        from public, anon;
revoke all on function admin.reorder_home_sections(text[])                           from public, anon;

grant execute on function admin._home_section_icons()                                to service_role;
grant execute on function admin._home_section_errors(public.home_feed_section_meta)   to service_role;
grant execute on function admin.list_home_sections()                                 to authenticated, service_role;
grant execute on function admin.update_home_section(text, jsonb)                    to authenticated, service_role;
grant execute on function admin.reorder_home_sections(text[])                        to authenticated, service_role;
