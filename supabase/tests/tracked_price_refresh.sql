-- pgTAP suite for claim_cards_for_price_refresh / apply_card_price_refresh / mark / release
-- (20261025000001_tracked_price_refresh_schema.sql).
--
-- Fixtures: a wishlisted card, a card held in a vault, an untracked card, and a tracked card
-- whose last attempt left it 'unresolved'. Claims are filtered to these fixture ids so the
-- local dev DB's own cards can't interfere.

begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into public.cards (id, name, set_name, genre, grades_prices)
values
  ('24000000-0000-0000-0000-00000000000a', 'Zzyx Wishlisted', 'S', 'Baseball', '{"psa10": 5000, "pc_only7": 10}'),
  ('24000000-0000-0000-0000-00000000000b', 'Zzyx Vaulted', 'S', 'Baseball', '{}'),
  ('24000000-0000-0000-0000-00000000000c', 'Zzyx Untracked', 'S', 'Baseball', '{}'),
  ('24000000-0000-0000-0000-00000000000d', 'Zzyx Unresolved', 'S', 'Baseball', '{}');

update public.cards
   set price_refresh_status = 'unresolved', price_refresh_attempted_at = now() - interval '2 days'
 where id = '24000000-0000-0000-0000-00000000000d';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values ('24000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-tpr@test.local', '', now(), '{}', '{}', false, false, now(), now());

insert into public.collections (id, user_id, name, is_wishlist)
values ('24000000-0000-0000-0000-0000000000c1', '24000000-0000-0000-0000-0000000000a1', 'Zzyx TPR Wishlist', true),
       ('24000000-0000-0000-0000-0000000000c2', '24000000-0000-0000-0000-0000000000a1', 'Zzyx TPR Vault', false);
insert into public.collection_items (collection_id, user_id, item_kind, ref_id, quantity)
values
  ('24000000-0000-0000-0000-0000000000c1', '24000000-0000-0000-0000-0000000000a1', 'card', '24000000-0000-0000-0000-00000000000a', 1),
  ('24000000-0000-0000-0000-0000000000c2', '24000000-0000-0000-0000-0000000000a1', 'card', '24000000-0000-0000-0000-00000000000b', 2),
  ('24000000-0000-0000-0000-0000000000c2', '24000000-0000-0000-0000-0000000000a1', 'card', '24000000-0000-0000-0000-00000000000d', 1);

insert into public.external_refs (provider, external_id, card_id, suggested_uuid)
values ('cardhedge', 'zzyx-ch-a', '24000000-0000-0000-0000-00000000000a', '24000000-0000-0000-0000-00000000000a');

create temp table t_claim1 as select * from public.claim_cards_for_price_refresh(100000);
create temp table t_claim2 as select * from public.claim_cards_for_price_refresh(100000);

select is(
  (select array_agg(id order by id) from t_claim1 where id::text like '24000000-%'),
  array['24000000-0000-0000-0000-00000000000a', '24000000-0000-0000-0000-00000000000b']::uuid[],
  'claims tracked stale cards only (not untracked, not unresolved inside its retry window)'
);
select is(
  (select cardhedge_id from t_claim1 where id = '24000000-0000-0000-0000-00000000000a'),
  'zzyx-ch-a',
  'claim returns the stored CardHedger id'
);
select is(
  (select count(*) from t_claim2 where id::text like '24000000-%'),
  0::bigint,
  'a second claim does not overlap leased cards'
);

-- Unresolved retry window elapsed → claimable again.
update public.cards set price_refresh_attempted_at = now() - interval '8 days'
 where id = '24000000-0000-0000-0000-00000000000d';
select is(
  (select count(*) from public.claim_cards_for_price_refresh(100000) where id = '24000000-0000-0000-0000-00000000000d'),
  1::bigint,
  'an unresolved card is reclaimed after its retry window'
);

-- Apply merges, writes history, sets state, releases the lease.
select is(
  public.apply_card_price_refresh('24000000-0000-0000-0000-00000000000a', '{"PSA 10": 6000.4, "Raw": 300}', 300) ->> 'changed',
  'true',
  'apply reports a change'
);
select is(
  (select grades_prices from public.cards where id = '24000000-0000-0000-0000-00000000000a'),
  '{"psa10": 6000, "pc_only7": 10, "ungraded": 300}'::jsonb,
  'apply merges normalized prices and keeps grades only another vendor has'
);
select ok(
  (select price_refresh_status = 'ok' and prices_refreshed_at is not null and price_refresh_locked_at is null
     from public.cards where id = '24000000-0000-0000-0000-00000000000a'),
  'apply marks the card ok and releases its lease'
);
select is(
  (select count(*) from public.card_price_history where card_id = '24000000-0000-0000-0000-00000000000a'),
  2::bigint,
  'apply writes one history row per grade'
);
select public.apply_card_price_refresh('24000000-0000-0000-0000-00000000000a', '{"psa10": 6100}', null);
select is(
  (select count(*) from public.card_price_history where card_id = '24000000-0000-0000-0000-00000000000a'),
  2::bigint,
  'a same-day re-apply adds no history rows'
);

select public.release_card_price_refresh(array['24000000-0000-0000-0000-00000000000b']::uuid[]);
select ok(
  (select price_refresh_locked_at is null and price_refresh_attempted_at is null
     from public.cards where id = '24000000-0000-0000-0000-00000000000b'),
  'release frees the lease without counting an attempt'
);

set local role authenticated;
select throws_ok(
  $$ select * from public.claim_cards_for_price_refresh(1) $$,
  '42501',
  null,
  'clients cannot call the claim RPC'
);
reset role;

select * from finish();
rollback;
