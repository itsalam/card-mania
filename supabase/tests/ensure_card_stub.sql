-- pgTAP suite for public.ensure_card_stub(...)
--
-- Targets the 9-arg overload (p_id, p_name, p_set_name, p_genre,
-- p_grades_prices, p_latest_price, p_image_url, p_provider, p_external_id) —
-- the one client/collections/mutate.ts calls when a card is first added to a
-- collection. ensure_card_stub returns void, so idempotency is asserted by
-- row state (no duplicate cards/external_refs rows, no clobber on re-call),
-- not by a returned id. A second, leaner 6-arg overload also exists but is
-- out of scope here.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- ── First call: provider card that doesn't exist yet ─────────────────────

select lives_ok(
  $$ select public.ensure_card_stub(
       '30000000-0000-0000-0000-00000000000a'::uuid,
       'Zzyx Stub Card',
       'Zzyx Stub Set',
       'trading_card',
       '{}'::jsonb,
       null,
       null,
       'zzyx_provider',
       'zzyx-ext-1'
     ) $$,
  'first ensure_card_stub call succeeds'
);

select is(
  (select count(*) from public.cards where id = '30000000-0000-0000-0000-00000000000a'),
  1::bigint,
  'stub row created in cards'
);

select is(
  (select count(*) from public.external_refs where provider = 'zzyx_provider' and external_id = 'zzyx-ext-1'),
  1::bigint,
  'external_refs row created for the stub'
);

-- ── Second call: same provider card again ─────────────────────────────────

select lives_ok(
  $$ select public.ensure_card_stub(
       '30000000-0000-0000-0000-00000000000a'::uuid,
       'Zzyx Stub Card',
       'Zzyx Stub Set',
       'trading_card',
       '{}'::jsonb,
       null,
       null,
       'zzyx_provider',
       'zzyx-ext-1'
     ) $$,
  'second (repeat) ensure_card_stub call succeeds'
);

select is(
  (select count(*) from public.cards where id = '30000000-0000-0000-0000-00000000000a'),
  1::bigint,
  'no duplicate card row after the repeat call'
);

select is(
  (select count(*) from public.external_refs where provider = 'zzyx_provider' and external_id = 'zzyx-ext-1'),
  1::bigint,
  'no duplicate external_refs row after the repeat call (on conflict do nothing)'
);

select * from finish();
rollback;
