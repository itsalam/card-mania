-- pgTAP: collection valuation and price freshness (ITS-133).
-- Owner O's collection V holds: card A (priced, 2 copies), card B (priced, refreshed by the
-- scheduled job more recently than its on-demand fetch), card C (no price for its grade).

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values ('30000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-val-o@test.local', '', now(), '{}', '{}', false, false, now(), now()),
       ('30000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-val-x@test.local', '', now(), '{}', '{}', false, false, now(), now());

insert into public.cards (id, name, set_name, genre, grades_prices, last_updated, prices_refreshed_at)
values
  ('30000000-0000-0000-0000-00000000000a', 'Zzyx VAL A', 'S', 'Baseball', '{"ungraded": 250}', '2026-11-20T00:00:00Z', null),
  ('30000000-0000-0000-0000-00000000000b', 'Zzyx VAL B', 'S', 'Baseball', '{"ungraded": 1000}', '2026-11-01T00:00:00Z', '2026-11-22T00:00:00Z'),
  ('30000000-0000-0000-0000-00000000000c', 'Zzyx VAL C', 'S', 'Baseball', '{"psa10": 5000}', '2026-11-23T00:00:00Z', null);

insert into public.collections (id, user_id, name)
values ('30000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000a1', 'Zzyx VAL V');
insert into public.collection_items (collection_id, user_id, item_kind, ref_id, quantity)
values
  ('30000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000a1', 'card', '30000000-0000-0000-0000-00000000000a', 2),
  ('30000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000a1', 'card', '30000000-0000-0000-0000-00000000000b', 1),
  ('30000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000a1', 'card', '30000000-0000-0000-0000-00000000000c', 1);

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

-- ── freshness helper ────────────────────────────────────────────────────────
select is(public.card_prices_as_of('2026-11-22Z', '2026-11-01Z'), '2026-11-22Z'::timestamptz,
  'freshness is the later of the scheduled refresh and the on-demand fetch');
select is(public.card_prices_as_of(null, '2026-11-01Z'), '2026-11-01Z'::timestamptz,
  'freshness falls back to the on-demand fetch');

-- ── valuation, as the owner ─────────────────────────────────────────────────
select pg_temp.act_as('30000000-0000-0000-0000-0000000000a1');
select is((select total_cents from public.collection_valuation('30000000-0000-0000-0000-0000000000d1')),
  1500::bigint, 'total = 2 x 250 + 1000; the unpriced card adds 0');
select is((select priced_quantity from public.collection_valuation('30000000-0000-0000-0000-0000000000d1')),
  3::bigint, 'priced copies counted by quantity');
select is((select unpriced_quantity from public.collection_valuation('30000000-0000-0000-0000-0000000000d1')),
  1::bigint, 'a card with no price for its grade is unpriced');
select is((select prices_as_of from public.collection_valuation('30000000-0000-0000-0000-0000000000d1')),
  '2026-11-20Z'::timestamptz, 'prices_as_of is the oldest price behind the total (unpriced cards ignored)');
select is((select newest_price_at from public.collection_valuation('30000000-0000-0000-0000-0000000000d1')),
  '2026-11-22Z'::timestamptz, 'newest_price_at uses the scheduled refresh when it''s later');
select is((select total_cents from public.collection_valuation('30000000-0000-0000-0000-0000000000d1')),
  (select total_cents::bigint from public.collection_totals where collection_id = '30000000-0000-0000-0000-0000000000d1'),
  'matches the collection_totals the app already shows');

-- ── another user can't see a private collection ─────────────────────────────
select pg_temp.act_as('30000000-0000-0000-0000-0000000000b1');
select is((select priced_quantity + unpriced_quantity from public.collection_valuation('30000000-0000-0000-0000-0000000000d1')),
  0::bigint, 'RLS: another user sees nothing in a private collection');

reset role;
select * from finish();
rollback;
