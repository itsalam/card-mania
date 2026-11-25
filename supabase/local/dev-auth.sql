-- LOCAL DEVELOPMENT ONLY. Never copy this into supabase/migrations: it would deploy to staging.
-- Applied by scripts/local-dev-auth.sh, which refuses any database but the local one.
--
-- Makes every local sign-in use the code/password 111111:
--   * Passwords: every email account's password becomes 111111, except the dev demo account
--     (cardmania_demo@demo.com keeps 123456; useUserStore signs into it in dev builds).
--   * Phone sign-in works without an SMS provider (see dev.send_sms_noop and config.toml).
--   * OTP codes: whatever code GoTrue generates (signup, magic link, recovery, phone SMS, email
--     change, reauthentication), 111111 also verifies it. GoTrue stores each code as
--     hex(sha224(<email or phone> || code)) in auth.one_time_tokens and on auth.users; a trigger
--     rewrites both to the hash of 111111. The email/SMS still shows GoTrue's random code, but
--     only 111111 verifies.

create schema if not exists dev;
revoke all on schema dev from public, anon, authenticated;

create or replace function dev.fixed_code() returns text
language sql immutable as $$ select '111111' $$;

create or replace function dev.code_hash(p_identity text) returns text
language sql immutable as $$
  select encode(sha224(convert_to(p_identity || dev.fixed_code(), 'UTF8')), 'hex')
$$;

-- auth.one_time_tokens: relates_to is the email or phone the code was sent to, and token_type
-- names the matching auth.users column.
create or replace function dev.fix_one_time_token() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_hash text := dev.code_hash(new.relates_to);
begin
  new.token_hash := v_hash;
  execute format('update auth.users set %I = $1 where id = $2 and coalesce(%I, '''') <> ''''',
                 new.token_type::text, new.token_type::text)
    using v_hash, new.user_id;
  return new;
end $$;

drop trigger if exists dev_fixed_otp on auth.one_time_tokens;
create trigger dev_fixed_otp
  before insert or update of token_hash on auth.one_time_tokens
  for each row execute function dev.fix_one_time_token();

-- Phone sign-in has no SMS provider locally: config.toml's [auth.hook.send_sms] hands each SMS
-- to this function, which drops it. The code is 111111 (trigger above).
create or replace function dev.send_sms_noop(event jsonb) returns jsonb
language sql as $$ select '{}'::jsonb $$;
grant usage on schema dev to supabase_auth_admin;
revoke all on function dev.send_sms_noop(jsonb) from public, anon, authenticated;
grant execute on function dev.send_sms_noop(jsonb) to supabase_auth_admin;

-- Passwords for existing accounts (run again after loading new data).
create or replace function dev.reset_passwords() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update auth.users
     set encrypted_password = extensions.crypt(dev.fixed_code(), extensions.gen_salt('bf'))
   where coalesce(is_anonymous, false) = false
     and email is not null and email <> ''
     and email <> 'cardmania_demo@demo.com';
  get diagnostics n = row_count;
  return n;
end $$;

select dev.reset_passwords() as passwords_reset;
