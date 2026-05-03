-- Fixes gaps in user provisioning on signup:
--   1. Default collections (Wishlist, Selling, Vault) never created — trigger was on
--      legacy public.profiles, not public.user_profile
--   2. collection_totals / collection_value_history not seeded for new collections
--   3. Unbounded username collision loop in provision_user_profile()
--   4. Missing updated_at trigger on user_profile
--   5. Dead handle_new_user() cleanup

-- ── 1. Trigger: provision default collections on user_profile INSERT ───────────

create or replace function public.trg_user_profile_ensure_defaults()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  perform public.ensure_default_collections_for_user(new.user_id);
  return new;
end;
$$;

drop trigger if exists trg_user_profile_defaults on public.user_profile;
create trigger trg_user_profile_defaults
  after insert on public.user_profile
  for each row execute function public.trg_user_profile_ensure_defaults();

-- ── 2. Seed collection_totals + collection_value_history on collection INSERT ──

create or replace function public.trg_collection_init_totals()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.collection_totals (collection_id, total_cents, quantity_total, computed_at)
  values (new.id, 0, 0, now())
  on conflict (collection_id) do nothing;

  insert into public.collection_value_history (collection_id, total_cents, quantity_total, snapshotted_at)
  values (new.id, 0, 0, now());

  return new;
end;
$$;

drop trigger if exists trg_collection_init_totals on public.collections;
create trigger trg_collection_init_totals
  after insert on public.collections
  for each row execute function public.trg_collection_init_totals();

-- ── 3. Cap username collision loop in provision_user_profile() ─────────────────
--    Previous version looped unboundedly on md5(random()) — 65 536 possible
--    suffixes means a stall is theoretically possible with very popular usernames.
--    Now capped at 20 random attempts; then falls back to the user's UUID prefix
--    which is guaranteed unique.

create or replace function public.provision_user_profile()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  raw_email   text;
  base_uname  text;
  final_uname text;
  suffix      text;
  attempts    int := 0;
begin
  raw_email  := coalesce(new.email, '');
  base_uname := lower(regexp_replace(split_part(raw_email, '@', 1), '[^a-z0-9_]', '_', 'g'));

  if base_uname = '' then
    base_uname := 'user';
  end if;

  final_uname := base_uname;

  while exists (select 1 from public.user_profile where username = final_uname) loop
    attempts := attempts + 1;
    if attempts >= 20 then
      final_uname := base_uname || '_' || left(new.id::text, 8);
      exit;
    end if;
    suffix      := substr(md5(random()::text), 1, 4);
    final_uname := base_uname || '_' || suffix;
  end loop;

  insert into public.user_profile (user_id, username, display_name)
  values (
    new.id,
    final_uname,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(raw_email, '@', 1)
    )
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ── 4. updated_at trigger on user_profile ──────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profile_set_updated_at on public.user_profile;
create trigger user_profile_set_updated_at
  before update on public.user_profile
  for each row execute procedure public.set_updated_at();

-- ── 5. Drop dead handle_new_user() ─────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
  ) then
    revoke all on function public.handle_new_user() from anon, authenticated, service_role;
    drop function public.handle_new_user();
  end if;
end;
$$;
