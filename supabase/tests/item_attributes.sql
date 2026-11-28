-- pgTAP: item attributes (cost basis, serial number, condition notes) and gain/loss (ITS-137).
--
-- Seller S owns 3 x card 1 (PSA 10, market $50) and 1 x card 2 (raw, market $8). Buyer B buys
-- card 2. O is another user. Covers privacy, the one-copy rule for serials, attributes riding
-- along List for Sale / Remove from sale, the buyer's cost basis and the seller's realized gain.

begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('13700000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-ia-s@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('13700000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-ia-b@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('13700000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-ia-o@test.local', '', now(), '{}', '{}', false, false, now(), now());

select public.ensure_default_collections_for_user(u)
  from unnest(array['13700000-0000-0000-0000-0000000000a1', '13700000-0000-0000-0000-0000000000b1', '13700000-0000-0000-0000-0000000000c1']::uuid[]) as u;

insert into public.cards (id, name, set_name, genre, grades_prices)
values ('13700000-0000-0000-0000-000000000001', 'Zzyx IA Card 1', 'S', 'Baseball', '{"psa10": 5000}'),
       ('13700000-0000-0000-0000-000000000002', 'Zzyx IA Card 2', 'S', 'Baseball', '{"ungraded": 800}');

create temp table ids (k text primary key, id uuid);
grant all on ids to authenticated;
insert into ids values
  ('grade',   (select gc.id from public.grade_conditions gc join public.grading_companies co on co.id = gc.company_id
                where co.slug = 'psa' and gc.grade_value = 10 limit 1)),
  ('s_vault', (select id from public.collections where user_id = '13700000-0000-0000-0000-0000000000a1' and is_vault)),
  ('b_vault', (select id from public.collections where user_id = '13700000-0000-0000-0000-0000000000b1' and is_vault));

insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity, grade_condition_id, grading_company)
values ('13700000-0000-0000-0000-0000000000e1', (select id from ids where k = 's_vault'), '13700000-0000-0000-0000-0000000000a1',
        'card', '13700000-0000-0000-0000-000000000001', 3, (select id from ids where k = 'grade'), 'psa'),
       ('13700000-0000-0000-0000-0000000000e2', (select id from ids where k = 's_vault'), '13700000-0000-0000-0000-0000000000a1',
        'card', '13700000-0000-0000-0000-000000000002', 1, null, null);

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

-- ── editing details ──────────────────────────────────────────────────────────

select pg_temp.act_as('13700000-0000-0000-0000-0000000000a1');

select is(
  (select cost_basis_cents || '/' || condition_notes || '/' || market_value_cents || '/' || unrealized_cents
     from public.set_item_details('13700000-0000-0000-0000-0000000000e1', 3000, null, '  Soft corner, top left  ')),
  '3000/Soft corner, top left/5000/6000',
  'set_item_details: saves cost per copy and trimmed notes; gain = (5000 - 3000) x 3');
select is((select count(*) from public.collection_item_private where collection_item_id = '13700000-0000-0000-0000-0000000000e1'),
  1::bigint, 'the owner can read their private attributes');
select is((select serial_number from public.collection_items where id = '13700000-0000-0000-0000-0000000000e1'),
  null, 'no serial number was set');

select throws_ok(
  $$ select * from public.set_item_details('13700000-0000-0000-0000-0000000000e1', 3000, '7/99', null) $$,
  '22023', null, 'a serial number is refused on a row holding 3 copies');
select throws_ok(
  $$ select * from public.set_item_details('13700000-0000-0000-0000-0000000000e1', -1, null, null) $$,
  '22023', null, 'a negative cost is refused');

select is(
  (select serial_number || '/' || cost_basis_cents from public.set_item_details('13700000-0000-0000-0000-0000000000e2', 500, ' 12/99 ', null)),
  '12/99/500', 'a single copy takes a (trimmed) serial number');
select throws_ok(
  $$ update public.collection_items set quantity = 2 where id = '13700000-0000-0000-0000-0000000000e2' $$,
  '23514', null, 'a row with a serial number can''t hold more than one copy');

-- ── privacy ──────────────────────────────────────────────────────────────────

select pg_temp.act_as('13700000-0000-0000-0000-0000000000c1');
select is((select count(*) from public.collection_item_private), 0::bigint, 'another user can''t read the private attributes');
select throws_ok(
  $$ select * from public.item_details('13700000-0000-0000-0000-0000000000e1') $$,
  'P0002', null, 'another user can''t read an item''s details');
select throws_ok(
  $$ select * from public.set_item_details('13700000-0000-0000-0000-0000000000e1', 1, null, null) $$,
  'P0002', null, 'another user can''t set an item''s details');
select throws_ok(
  $$ insert into public.collection_item_private (collection_item_id, user_id, cost_basis_cents)
     values ('13700000-0000-0000-0000-0000000000e1', '13700000-0000-0000-0000-0000000000c1', 1) $$,
  '42501', null, 'the private table can''t be written directly');

-- ── List for Sale carries them; mirrors read through to the listing ──────────

select pg_temp.act_as('13700000-0000-0000-0000-0000000000a1');
insert into ids select 'l1', (public.list_for_sale('13700000-0000-0000-0000-0000000000e1', 1, 4500)).id;
reset role;
insert into ids values
  ('l1_vault', (select id from public.collection_items where mirror_of = (select id from public.collection_items where mirror_of = (select id from ids where k = 'l1'))));

select is((select cost_basis_cents || '/' || condition_notes from public.collection_item_private where collection_item_id = (select id from ids where k = 'l1')),
  '3000/Soft corner, top left', 'list: the listing gets the copies'' cost and notes');

select pg_temp.act_as('13700000-0000-0000-0000-0000000000a1');
select is((select cost_basis_cents || '/' || root_id from public.item_details((select id from ids where k = 'l1_vault'))),
  '3000/' || (select id from ids where k = 'l1'), 'the Vault mirror reads them from the listing');

select is((select cost_basis_cents from public.set_item_details((select id from ids where k = 'l1_vault'), 3500, null, 'Soft corner, top left')),
  3500, 'editing from the Vault mirror works');
reset role;
select is((select cost_basis_cents from public.collection_item_private where collection_item_id = (select id from ids where k = 'l1')),
  3500, '... and is stored on the listing');
select is((select count(*) from public.collection_item_private where collection_item_id = (select id from ids where k = 'l1_vault')),
  0::bigint, '... not on the mirror');

-- Owned now: e1 2 x (5000 - 3000) + listing 1 x (5000 - 3500), and e2 1 x (800 - 500).
select pg_temp.act_as('13700000-0000-0000-0000-0000000000a1');
select is((select unrealized_cents || '/' || cost_cents || '/' || with_cost_quantity || '/' || without_cost_quantity from public.portfolio_gain()),
  '5800/10000/4/0', 'portfolio_gain: unrealized gain over the Vault, listing counted once');

-- ── Remove from sale doesn't average costs away ──────────────────────────────

insert into ids select 'pc_back', (public.unlist_item((select id from ids where k = 'l1'))).id;
reset role;
select isnt((select id from ids where k = 'pc_back'), '13700000-0000-0000-0000-0000000000e1'::uuid,
  'unlist: a different cost gets its own PC row');
select is((select quantity from public.collection_items where id = '13700000-0000-0000-0000-0000000000e1'), 2,
  'unlist: the original PC row is unchanged');
select is((select cost_basis_cents from public.collection_item_private where collection_item_id = (select id from ids where k = 'pc_back')),
  3500, 'unlist: the new PC row keeps its cost');

select pg_temp.act_as('13700000-0000-0000-0000-0000000000a1');
insert into ids select 'l2', (public.list_for_sale('13700000-0000-0000-0000-0000000000e1', 1, 4500)).id;
insert into ids select 'pc_back2', (public.unlist_item((select id from ids where k = 'l2'))).id;
reset role;
select is((select id from ids where k = 'pc_back2'), '13700000-0000-0000-0000-0000000000e1'::uuid,
  'unlist: the same cost and notes merge back into the PC row');
select is((select quantity from public.collection_items where id = '13700000-0000-0000-0000-0000000000e1'), 2,
  'unlist: ... with its copy back');

-- ── A sale: buyer's cost basis and seller's realized gain ────────────────────

select pg_temp.act_as('13700000-0000-0000-0000-0000000000a1');
insert into ids select 'l3', (public.list_for_sale('13700000-0000-0000-0000-0000000000e2', 1, 4000)).id;
reset role;
select is((select string_agg(coalesce(serial_number, '-'), ',' order by collection_id) from public.collection_items
            where id = (select id from ids where k = 'l3') or mirror_of = (select id from ids where k = 'l3')
               or mirror_of = (select id from public.collection_items where mirror_of = (select id from ids where k = 'l3'))),
  '12/99,12/99,12/99', 'list: the serial number is on the listing and both mirrors');

select pg_temp.act_as('13700000-0000-0000-0000-0000000000b1');
insert into ids select 'o1', (public.create_offer('13700000-0000-0000-0000-0000000000a1',
  json_build_array(json_build_object('collection_item_id', (select id from ids where k = 'l3'), 'quantity', 1, 'offered_price_per_unit', 40))::jsonb)).id;
select pg_temp.act_as('13700000-0000-0000-0000-0000000000a1');
select public.accept_offer((select id from ids where k = 'o1'));
select public.mark_transaction_shipped((select id from ids where k = 'o1'));
select pg_temp.act_as('13700000-0000-0000-0000-0000000000b1');
select lives_ok($$ select public.confirm_transaction_receipt((select id from ids where k = 'o1')) $$, 'buyer confirms receipt');

reset role;
insert into ids values ('b_row', (select id from public.collection_items where collection_id = (select id from ids where k = 'b_vault')
                                     and ref_id = '13700000-0000-0000-0000-000000000002'));
select is((select serial_number from public.collection_items where id = (select id from ids where k = 'b_row')),
  '12/99', 'the buyer''s copy keeps its serial number');
select is((select cost_basis_cents || '/' || coalesce(condition_notes, '-') || '/' || user_id from public.collection_item_private
            where collection_item_id = (select id from ids where k = 'b_row')),
  '4000/-/13700000-0000-0000-0000-0000000000b1', 'the buyer''s cost basis is the price paid; the seller''s notes stay behind');
select is((select seller_id || '/' || quantity || '/' || sale_price_cents || '/' || cost_basis_cents from public.realized_sales
            where transaction_id = (select id from public.transactions where offer_id = (select id from ids where k = 'o1'))),
  '13700000-0000-0000-0000-0000000000a1/1/4000/500', 'the seller''s sale is recorded with their cost basis');

select pg_temp.act_as('13700000-0000-0000-0000-0000000000a1');
select is((select realized_cents || '/' || realized_quantity || '/' || realized_without_cost_quantity from public.portfolio_gain()),
  '3500/1/0', 'portfolio_gain: realized gain (4000 - 500)');

select pg_temp.act_as('13700000-0000-0000-0000-0000000000b1');
select is((select count(*) from public.realized_sales), 0::bigint, 'the buyer can''t see the seller''s realized gain');
select is((select unrealized_cents || '/' || with_cost_quantity from public.portfolio_gain()),
  '-3200/1', 'the buyer''s unrealized gain starts from what they paid (800 - 4000)');

-- ── clearing ─────────────────────────────────────────────────────────────────

select pg_temp.act_as('13700000-0000-0000-0000-0000000000a1');
select lives_ok($$ select * from public.set_item_details('13700000-0000-0000-0000-0000000000e1', null, '', '   ') $$, 'clearing every field');
reset role;
select is((select count(*) from public.collection_item_private where collection_item_id = '13700000-0000-0000-0000-0000000000e1'),
  0::bigint, '... removes the private row');

select * from finish();
rollback;
