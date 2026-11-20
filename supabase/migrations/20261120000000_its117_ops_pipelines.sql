-- ITS-117 (part 2): ops dashboards for the price refresh and enrichment pipelines, and
-- notifications.
--
--   admin.price_refresh_overview()        backlog, outcome mix (7 d), recent runs, and the
--                                         lowest-confidence matches for spot checks
--   admin.queue_card_price_refresh(card)  make one tracked card due on the next refresh run (audited)
--   admin.enrichment_overview()           backlog, vendor outcomes (7 d), recent runs, and the
--                                         lowest-scoring image hits
--   admin.notification_overview(hours)    volume by type and category, read/dismissed, and the
--                                         wishlist-hit split (individual vs summary) and dedupe table
--
-- Role ops (owner always passes). The overviews wrap the existing monitoring views
-- (public.price_refresh_backlog / price_refresh_outcomes, public.enrichment_backlog /
-- enrichment_vendor_outcomes) rather than granting them, so the console holds no table access.

-- ── Price refresh ──────────────────────────────────────────────────────────────────────────────
create or replace function admin.price_refresh_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin._require_role('ops');
  return jsonb_build_object(
    'backlog', (select to_jsonb(b) from public.price_refresh_backlog b),
    'outcomes', coalesce((select jsonb_agg(to_jsonb(o)) from public.price_refresh_outcomes o), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.started_at desc)
        from (select id, started_at, finished_at, status, claimed, refreshed, unchanged, unresolved,
                     failed, resolves_used, left(error, 300) as error
                from public.price_refresh_runs
               order by started_at desc
               limit 20) r), '[]'::jsonb),
    -- Matches accepted on a fuzzy match, weakest first: the ones worth a human look.
    'low_confidence', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.match_confidence asc nulls first)
        from (select a.card_id, c.name, c.set_name, a.outcome, a.match_confidence,
                     a.matched_description, a.cardhedge_id, a.created_at
                from public.card_price_refresh_attempts a
                join public.cards c on c.id = a.card_id
               where a.outcome in ('resolved_match', 'low_confidence')
                 and a.created_at > now() - interval '7 days'
               order by a.match_confidence asc nulls first
               limit 25) x), '[]'::jsonb)
  );
end;
$$;

-- Makes a tracked card due now, so the next tracked-price-refresh run (at :07 and :37) can pick
-- it. It doesn't jump the queue: runs take cards in their usual order (wishlisted first, then
-- least recently refreshed), so with a large backlog it can take a few runs. Only cards in
-- someone's collection are refreshed at all.
create or replace function admin.queue_card_price_refresh(p_card_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_name   text;
begin
  perform admin._require_role('ops');
  select jsonb_build_object('price_refresh_attempted_at', c.price_refresh_attempted_at,
                            'price_refresh_locked_at', c.price_refresh_locked_at,
                            'price_refresh_status', c.price_refresh_status),
         c.name
    into v_before, v_name
    from public.cards c where c.id = p_card_id
    for update;
  if not found then
    raise exception 'no card %', p_card_id using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.collection_items ci
                  where ci.item_kind = 'card'::public.item_kind and ci.ref_id = p_card_id
                    and (ci.quantity is null or ci.quantity > 0)) then
    raise exception 'card is not in any collection, so it is not refreshed' using errcode = '22023';
  end if;

  -- '-infinity' makes the card due whatever its status (the claim compares
  -- coalesce(attempted_at, refreshed_at) with a status-based cutoff). prices_refreshed_at is left
  -- alone: other code reads it as "server prices are authoritative".
  update public.cards c
     set price_refresh_attempted_at = '-infinity', price_refresh_locked_at = null
   where c.id = p_card_id;

  perform admin._audit('card.queue_price_refresh', 'card', p_card_id::text, v_before,
                       jsonb_build_object('price_refresh_attempted_at', '-infinity'));
  return jsonb_build_object('card_id', p_card_id, 'name', v_name, 'queued', true);
end;
$$;

-- ── Enrichment ─────────────────────────────────────────────────────────────────────────────────
create or replace function admin.enrichment_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin._require_role('ops');
  return jsonb_build_object(
    'backlog', (select to_jsonb(b) from public.enrichment_backlog b),
    'vendor_outcomes', coalesce((select jsonb_agg(to_jsonb(o)) from public.enrichment_vendor_outcomes o), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.started_at desc)
        from (select id, started_at, finished_at, status, vendors, claimed, enriched, no_match,
                     failed, hits_by_vendor, left(error, 300) as error
                from public.enrichment_runs
               order by started_at desc
               limit 20) r), '[]'::jsonb),
    -- Image hits accepted with the lowest match scores: the likeliest wrong pictures.
    'low_score_hits', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.best_score asc nulls first)
        from (select a.card_id, c.name, c.set_name, a.vendor, a.best_score, a.matched_title,
                     a.image_url, a.created_at
                from public.card_enrichment_attempts a
                join public.cards c on c.id = a.card_id
               where a.outcome = 'hit'
                 and a.created_at > now() - interval '7 days'
               order by a.best_score asc nulls first
               limit 25) x), '[]'::jsonb)
  );
end;
$$;

-- ── Notifications ──────────────────────────────────────────────────────────────────────────────
create or replace function admin.notification_overview(p_hours int default 24 * 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - make_interval(hours => least(greatest(coalesce(p_hours, 168), 1), 24 * 90));
begin
  perform admin._require_role('ops');
  return jsonb_build_object(
    'since', v_since,
    'by_type', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.sent desc)
        from (select n.type, n.category,
                     count(*)::int as sent,
                     count(distinct n.user_id)::int as users,
                     count(*) filter (where n.read_at is not null)::int as read,
                     count(*) filter (where n.dismissed_at is not null)::int as dismissed,
                     max(n.created_at) as last_sent
                from public.notifications n
               where n.created_at > v_since
               group by n.type, n.category) x), '[]'::jsonb),
    'wishlist_hits', jsonb_build_object(
      'individual', (select count(*)::int from public.notifications n
                      where n.type = 'wishlist_hit' and n.created_at > v_since
                        and coalesce((n.payload ->> 'summary')::boolean, false) = false),
      'summary',    (select count(*)::int from public.notifications n
                      where n.type = 'wishlist_hit' and n.created_at > v_since
                        and coalesce((n.payload ->> 'summary')::boolean, false)),
      'dedupe_rows',   (select count(*)::int from public.wishlist_hit_notifications),
      'dedupe_seeded', (select count(*)::int from public.wishlist_hit_notifications w where w.seeded)
    )
  );
end;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────────────────────────
revoke all on function admin.price_refresh_overview()          from public, anon;
revoke all on function admin.queue_card_price_refresh(uuid)    from public, anon;
revoke all on function admin.enrichment_overview()             from public, anon;
revoke all on function admin.notification_overview(int)        from public, anon;

grant execute on function admin.price_refresh_overview()       to authenticated, service_role;
grant execute on function admin.queue_card_price_refresh(uuid) to authenticated, service_role;
grant execute on function admin.enrichment_overview()          to authenticated, service_role;
grant execute on function admin.notification_overview(int)     to authenticated, service_role;
