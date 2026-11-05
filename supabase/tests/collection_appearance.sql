-- pgTAP suite for ITS-98 collection appearance (20261104000002).
--
-- The new columns are validated, flow through the recreated collections_with_tags view and
-- the membership RPCs, and the view still runs as the caller (security_invoker) so it stays
-- scoped by collections RLS.

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('2b000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-appear-1@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('2b000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-appear-2@test.local', '', now(), '{}', '{}', false, false, now(), now());

insert into public.collections (id, user_id, name, visibility, icon_key, accent_color)
values ('2b000000-0000-0000-0000-0000000000c1', '2b000000-0000-0000-0000-0000000000a1', 'Zzyx Appearance', 'private', 'trophy', 'cyan');

select throws_ok($$ update public.collections set accent_color = '#ff0000'
                     where id = '2b000000-0000-0000-0000-0000000000c1' $$,
                 '23514', null, 'accent_color must be a palette key, not a hex value');
select throws_ok($$ update public.collections set icon_key = 'Not A Key!'
                     where id = '2b000000-0000-0000-0000-0000000000c1' $$,
                 '23514', null, 'icon_key must be a slug');
select lives_ok($$ update public.collections set icon_key = null, accent_color = null
                    where id = '2b000000-0000-0000-0000-0000000000c1' $$,
                'appearance is optional');
update public.collections set icon_key = 'trophy', accent_color = 'cyan'
 where id = '2b000000-0000-0000-0000-0000000000c1';

select is((select icon_key || '/' || accent_color from public.collections_with_tags
            where id = '2b000000-0000-0000-0000-0000000000c1'),
          'trophy/cyan', 'collections_with_tags exposes the new columns');
select is((select icon_key || '/' || accent_color
             from public.collections_with_membership('2b000000-0000-0000-0000-0000000000a1', gen_random_uuid())
            where id = '2b000000-0000-0000-0000-0000000000c1'),
          'trophy/cyan', 'collections_with_membership returns them');
select is((select count(*)
             from public.collections_with_membership_query('2b000000-0000-0000-0000-0000000000a1', gen_random_uuid(), 'appearance')
            where accent_color = 'cyan'),
          1::bigint, 'collections_with_membership_query returns them');

select is((select array_to_string(reloptions, ',') from pg_class where relname = 'collections_with_tags'),
          'security_invoker=true', 'the recreated view keeps security_invoker');

-- Default background: the most valuable card, maintained through the queue + refresh job.
insert into public.cards (id, name, set_name, genre, grades_prices)
values
  ('2b000000-0000-0000-0000-0000000000d1', 'Zzyx Cheap', 'Zzyx Set', 'pokemon', '{"ungraded": 500}'),
  ('2b000000-0000-0000-0000-0000000000d2', 'Zzyx Pricey', 'Zzyx Set', 'pokemon', '{"ungraded": 90000}');

delete from public.collection_background_queue;
insert into public.collection_items (collection_id, user_id, ref_id, quantity)
values
  ('2b000000-0000-0000-0000-0000000000c1', '2b000000-0000-0000-0000-0000000000a1', '2b000000-0000-0000-0000-0000000000d1', 10),
  ('2b000000-0000-0000-0000-0000000000c1', '2b000000-0000-0000-0000-0000000000a1', '2b000000-0000-0000-0000-0000000000d2', 1);

select is((select count(*) from public.collection_background_queue
            where collection_id = '2b000000-0000-0000-0000-0000000000c1'),
          1::bigint, 'adding items enqueues the collection once');

select public.refresh_collection_backgrounds();
select is((select default_background_card_id from public.collections
            where id = '2b000000-0000-0000-0000-0000000000c1'),
          '2b000000-0000-0000-0000-0000000000d2'::uuid,
          'default background is the highest-value card, not the largest stack');
select is((select count(*) from public.collection_background_queue), 0::bigint,
          'the refresh drains the queue');

update public.cards set grades_prices = '{"ungraded": 200000}'
 where id = '2b000000-0000-0000-0000-0000000000d1';
select public.refresh_collection_backgrounds();
select is((select default_background_card_id from public.collections
            where id = '2b000000-0000-0000-0000-0000000000c1'),
          '2b000000-0000-0000-0000-0000000000d1'::uuid,
          'a price change re-ranks the default');

delete from public.collection_items
 where collection_id = '2b000000-0000-0000-0000-0000000000c1'
   and ref_id = '2b000000-0000-0000-0000-0000000000d1';
select public.refresh_collection_backgrounds();
select is((select default_background_card_id
             from public.collections_with_membership('2b000000-0000-0000-0000-0000000000a1', gen_random_uuid())
            where id = '2b000000-0000-0000-0000-0000000000c1'),
          '2b000000-0000-0000-0000-0000000000d2'::uuid,
          'removing the top card falls back to the next one, exposed by the membership RPC');

select is((select count(*) from cron.job where jobname = 'collection-backgrounds-refresh'),
          1::bigint, 'the refresh job is scheduled');

-- As user 2, user 1's private collection must not be visible through the view.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"2b000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*) from public.collections_with_tags where id = '2b000000-0000-0000-0000-0000000000c1'),
          0::bigint, 'the view is still scoped by collections RLS');
reset role;

select * from finish();
rollback;
