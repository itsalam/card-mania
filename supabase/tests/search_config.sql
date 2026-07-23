-- pgTAP suite for public.search_config
-- Verifies: singleton row, expected columns, and RLS (anon can read the
-- config but cannot write it).
--
-- Read-only assertions; runs inside BEGIN/ROLLBACK for consistency with the
-- rest of the suite even though nothing here mutates state outside the RLS
-- probe (which itself only ever affects 0 rows).

begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

select is(
  (select count(*) from public.search_config where id = 1),
  1::bigint,
  'search_config singleton row (id = 1) exists'
);

select has_column('public', 'search_config', 'weight_fts', 'has weight_fts column');
select has_column('public', 'search_config', 'weight_trgm', 'has weight_trgm column');
select has_column('public', 'search_config', 'weight_vector', 'has weight_vector column');
select has_column('public', 'search_config', 'weight_pop', 'has weight_pop column');
select has_column('public', 'search_config', 'pop_wishlist_weight', 'has pop_wishlist_weight column');
select has_column('public', 'search_config', 'pop_sale_weight', 'has pop_sale_weight column');
select has_column('public', 'search_config', 'pop_log_divisor', 'has pop_log_divisor column');
select has_column('public', 'search_config', 'min_score', 'has min_score column');

-- RLS: anon can SELECT (search_config_read policy: USING (true), and anon
-- does hold base table SELECT grant).
set local role anon;
select lives_ok(
  $$ select count(*) from public.search_config $$,
  'anon can SELECT from search_config'
);

-- RLS: anon cannot UPDATE. anon does hold the base UPDATE grant, so this
-- does not throw — the search_config_admin policy (auth.role() =
-- 'service_role') silently filters out every row, leaving 0 rows updated.
with updated as (
  update public.search_config set min_score = 1 where id = 1 returning 1
)
select is((select count(*) from updated), 0::bigint, 'anon UPDATE on search_config affects 0 rows (RLS)');
reset role;

select * from finish();
rollback;
