-- pgTAP suite for canonical grade price keys (migration 20261025000000).
--
-- Case table mirrors supabase/functions/_shared/grade-key.test.ts — keep the two in sync.
-- Fixtures: a card stored with CardHedge-style keys ("PSA 10", "Raw"), a seller listing a
-- PSA 10 copy of it, and a wishlist row for the same PSA 10 grade — so the marketplace and
-- wishlist-cost paths (which used to look up "psa10.0") can be checked for real prices.

begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

-- ── Helpers ──────────────────────────────────────────────────────────────

select is(
  (select array_agg(public.normalize_grade_key(k) order by ord)
     from unnest(array['psa10','psa_10','PSA 10','psa10.0','bgs9.5','bgs_9.5','bgs9_5','BGS 9.5',
                       'Raw','ungraded','cgc 10','sgc9_0','weird key']) with ordinality u(k, ord)),
  array['psa10','psa10','psa10','psa10','bgs9_5','bgs9_5','bgs9_5','bgs9_5',
        'ungraded','ungraded','cgc10','sgc9','weird key'],
  'normalize_grade_key maps every known spelling'
);

select is(
  (select count(*) from unnest(array['psa_10','BGS 9.5','Raw','psa10.0']) k
    where public.normalize_grade_key(public.normalize_grade_key(k)) <> public.normalize_grade_key(k)),
  0::bigint,
  'normalize_grade_key is idempotent'
);

select is(public.grade_key('psa', 10.0), 'psa10', 'grade_key 10.0 → psa10');
select is(public.grade_key('psa', 10::numeric), 'psa10', 'grade_key unscaled 10 → psa10 (not psa1)');
select is(public.grade_key('bgs', 9.5), 'bgs9_5', 'grade_key 9.5 → bgs9_5');
select is(public.grade_key(null, 9.5), null, 'grade_key with no slug is null');
select is(public.grade_condition_price_key(null), 'ungraded', 'null grade condition → ungraded');

select is(
  public.normalize_grades_prices('{"psa10": 100, "psa_10": 200, "Raw": 5}'::jsonb),
  '{"psa10": 200, "ungraded": 5}'::jsonb,
  'normalize_grades_prices: CardHedge spelling wins a collision'
);

select is(
  public.normalize_grades_prices('{"PSA 10": 1234.5, "Raw": 99.4}'::jsonb),
  '{"psa10": 1235, "ungraded": 99}'::jsonb,
  'normalize_grades_prices rounds to whole cents (readers cast ->> to int)'
);

-- ── Fixtures ─────────────────────────────────────────────────────────────

insert into public.cards (id, name, set_name, genre, grades_prices, latest_price)
values ('22000000-0000-0000-0000-00000000000a', 'Zzyx Grade Key Card', 'Set G', 'Baseball',
        '{"PSA 10": 5000, "Raw": 400}', 400);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('22000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-gk-buyer@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('22000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-gk-seller@test.local', '', now(), '{}', '{}', false, false, now(), now());

create temp table t_psa10 as
  select gcnd.id from public.grade_conditions gcnd
    join public.grading_companies gc on gc.id = gcnd.company_id
   where gc.slug = 'psa' and gcnd.grade_value = 10 limit 1;

insert into public.collections (id, user_id, name, is_storefront)
values ('22000000-0000-0000-0000-0000000000c1', '22000000-0000-0000-0000-0000000000a2', 'Zzyx GK Storefront', true);
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity, grade_condition_id, grading_company)
values ('22000000-0000-0000-0000-0000000000d1', '22000000-0000-0000-0000-0000000000c1', '22000000-0000-0000-0000-0000000000a2',
        'card', '22000000-0000-0000-0000-00000000000a', 1, (select id from t_psa10), 'psa');
insert into public.storefronts (id, user_id, is_listed, collection_ids)
values ('22000000-0000-0000-0000-0000000000e1', '22000000-0000-0000-0000-0000000000a2', true,
        array['22000000-0000-0000-0000-0000000000c1']::uuid[]);

-- ── Write-path normalization ─────────────────────────────────────────────

select is(
  (select grades_prices from public.cards where id = '22000000-0000-0000-0000-00000000000a'),
  '{"psa10": 5000, "ungraded": 400}'::jsonb,
  'cards insert trigger normalizes grades_prices keys'
);

update public.cards set grades_prices = '{"BGS 9.5": 3000, "psa10": 5000, "ungraded": 400}'
 where id = '22000000-0000-0000-0000-00000000000a';
select ok(
  (select grades_prices ? 'bgs9_5' from public.cards where id = '22000000-0000-0000-0000-00000000000a'),
  'cards update trigger normalizes grades_prices keys'
);

-- Seller holds 2 copies; a price change must bump the storefront collection total by 2×.
update public.collection_items set quantity = 2 where id = '22000000-0000-0000-0000-0000000000d1';
create temp table t_before as
  select total_cents from public.collection_totals where collection_id = '22000000-0000-0000-0000-0000000000c1';
update public.cards set grades_prices = grades_prices || '{"psa10": 5500}'
 where id = '22000000-0000-0000-0000-00000000000a';
select is(
  (select ct.total_cents - coalesce((select total_cents from t_before), 0)
     from public.collection_totals ct where ct.collection_id = '22000000-0000-0000-0000-0000000000c1'),
  1000,
  'collection totals trigger applies quantity × price delta (used to raise a GROUP BY error)'
);
update public.cards set grades_prices = grades_prices || '{"psa10": 5000}'
 where id = '22000000-0000-0000-0000-00000000000a';

insert into public.card_price_history (card_id, grade, price_cents, recorded_at)
values ('22000000-0000-0000-0000-00000000000a', 'PSA 10', 5000, now());
select is(
  (select grade from public.card_price_history where card_id = '22000000-0000-0000-0000-00000000000a'),
  'psa10',
  'card_price_history insert trigger normalizes grade'
);

insert into public.card_price_history (card_id, grade, price_cents, recorded_at)
values ('22000000-0000-0000-0000-00000000000a', 'psa_10', 5100, now())
on conflict (card_id, grade, recorded_date) do nothing;
select is(
  (select count(*) from public.card_price_history where card_id = '22000000-0000-0000-0000-00000000000a'),
  1::bigint,
  'same-day upsert under another spelling conflicts on the canonical grade'
);

-- ── Key-building functions resolve graded prices ─────────────────────────

select is(
  (select price_key from public._marketplace_base_listings() where ref_id = '22000000-0000-0000-0000-00000000000a'),
  'psa10',
  '_marketplace_base_listings price_key is canonical'
);
select is(
  (select market_value from public._marketplace_base_listings() where ref_id = '22000000-0000-0000-0000-00000000000a'),
  5000,
  '_marketplace_base_listings resolves a graded market value (was 0)'
);
select is(
  public._wishlist_row_cost_cents_from_collection_item(
    'card', '22000000-0000-0000-0000-00000000000a', (select id from t_psa10), 'psa'),
  5000,
  'wishlist row cost resolves a graded price (was 0)'
);
select is(
  public._collection_item_value_cents('card', '22000000-0000-0000-0000-00000000000a', (select id from t_psa10), 2),
  10000,
  'collection item value still resolves graded prices'
);

select is(
  (select count(*) from pg_proc
    where pronamespace = 'public'::regnamespace
      and prosrc ~ 'slug\s*\|\|\s*gcnd\.grade_value\s*::\s*text'),
  0::bigint,
  'no function builds a key as slug || grade_value::text anymore'
);

select * from finish();
rollback;
