-- pgTAP suite for the admin console foundation (20261112000000, ITS-116).
--
-- Every admin RPC must deny anon and signed-in non-members, roles must gate what members can
-- do (owner > editor/ops), tables must be unreachable directly, and every write must leave an
-- append-only audit row attributed to the caller.

begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('11600000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-admin-owner@test.local',  '', now(), '{}', '{}', false, false, now(), now()),
  ('11600000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-admin-editor@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('11600000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-admin-ops@test.local',    '', now(), '{}', '{}', false, false, now(), now()),
  ('11600000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-admin-nobody@test.local', '', now(), '{}', '{}', false, false, now(), now());

-- Bootstrap: the first owner is seeded with SQL (docs/admin-console.md); the rest go through RPCs.
insert into admin.members (user_id, role) values ('11600000-0000-0000-0000-0000000000a1', 'owner');

-- ── Anonymous ───────────────────────────────────────────────────────────────────────────────

set local role anon;
select throws_ok($$ select admin.whoami() $$, '42501', null, 'anon cannot reach the admin schema');
reset role;

-- ── Signed-in non-member ────────────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11600000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);

select is(admin.has_role(), false, 'non-member: has_role() is false');
select throws_ok($$ select admin.whoami() $$, '42501', 'not authorized', 'non-member: whoami denied');
select throws_ok($$ select * from admin.list_members() $$, '42501', 'not authorized', 'non-member: list_members denied');
select throws_ok($$ select admin.set_member_role('zzyx-admin-nobody@test.local', 'owner') $$,
                 '42501', 'not authorized', 'non-member: cannot make themselves owner');
select throws_ok($$ select admin.remove_member('11600000-0000-0000-0000-0000000000a1') $$,
                 '42501', 'not authorized', 'non-member: remove_member denied');
select throws_ok($$ select * from admin.list_audit_log() $$, '42501', 'not authorized', 'non-member: list_audit_log denied');
select throws_ok($$ select * from admin.members $$, '42501', null, 'non-member: members table not directly readable');
select throws_ok($$ insert into admin.audit_log (action) values ('forged') $$, '42501', null,
                 'non-member: audit_log not directly writable');
select throws_ok($$ select admin._require_role('owner') $$, '42501', null, 'internal helpers are not executable by clients');
select throws_ok($$ select admin._audit('forged') $$, '42501', null, 'the audit helper is not executable by clients');

-- ── Owner ───────────────────────────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"11600000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is(admin.whoami() ->> 'role', 'owner', 'owner: whoami returns the role');
select is(admin.has_role('editor'), true, 'owner passes any role check');

select is(admin.set_member_role('zzyx-admin-editor@test.local', 'editor') ->> 'role', 'editor', 'owner can add an editor');
select is(admin.set_member_role('ZZYX-Admin-Ops@test.local ', 'ops') ->> 'role', 'ops', 'email lookup ignores case and spaces');
select throws_ok($$ select admin.set_member_role('zzyx-missing@test.local', 'ops') $$, 'P0002', null, 'unknown email is rejected');
select throws_ok($$ select admin.set_member_role('zzyx-admin-nobody@test.local', 'superuser') $$, '22023', null, 'unknown role is rejected');
select throws_ok($$ select admin.set_member_role('zzyx-admin-owner@test.local', 'editor') $$, '22023', null, 'the last owner cannot be demoted');
select throws_ok($$ select admin.remove_member('11600000-0000-0000-0000-0000000000a1') $$, '22023', null, 'the last owner cannot be removed');
select is((select count(*)::int from admin.list_members()), 3, 'owner sees all members');

-- ── Editor and ops ──────────────────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"11600000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is(admin.whoami() ->> 'role', 'editor', 'editor: whoami works');
select throws_ok($$ select admin.set_member_role('zzyx-admin-editor@test.local', 'owner') $$,
                 '42501', 'not authorized', 'editor cannot promote themselves');
select throws_ok($$ select * from admin.list_audit_log() $$, '42501', 'not authorized', 'editor cannot read the audit log');

select set_config('request.jwt.claims', '{"sub":"11600000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select ok((select count(*) from admin.list_audit_log()) >= 2, 'ops can read the audit log');

reset role;

-- ── Audit trail ─────────────────────────────────────────────────────────────────────────────

select results_eq(
  $$ select actor, action, target_id, before ->> 'role', after ->> 'role'
       from admin.audit_log where target_type = 'member' order by id $$,
  $$ values ('11600000-0000-0000-0000-0000000000a1'::uuid, 'member.set_role', '11600000-0000-0000-0000-0000000000a2', null::text, 'editor'),
            ('11600000-0000-0000-0000-0000000000a1'::uuid, 'member.set_role', '11600000-0000-0000-0000-0000000000a3', null::text, 'ops') $$,
  'each change is logged with the acting owner and before/after');

select throws_ok($$ update admin.audit_log set action = 'tampered' $$, '42501', null, 'audit rows cannot be edited');
select throws_ok($$ delete from admin.audit_log $$, '42501', null, 'audit rows cannot be deleted');

-- Deleting an account that made audited changes must still work, and the log keeps who it was.
update admin.members set role = 'owner' where user_id = '11600000-0000-0000-0000-0000000000a2';
select lives_ok($$ delete from auth.users where id = '11600000-0000-0000-0000-0000000000a1' $$,
                'a user who made audited changes can still be deleted');
select is((select count(*)::int from admin.audit_log
            where actor = '11600000-0000-0000-0000-0000000000a1'
              and actor_email = 'zzyx-admin-owner@test.local'), 2,
          'their audit rows survive with the email captured at write time');

select * from finish();
rollback;
