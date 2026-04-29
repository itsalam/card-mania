-- Auto-provision a user_profile row whenever a new auth.users row is created.
-- This is the canonical server-side path; the client-side upsert in signUp()
-- is a belt-and-suspenders complement.

create or replace function public.provision_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_email   text;
  base_uname  text;
  final_uname text;
  suffix      text;
begin
  raw_email  := coalesce(new.email, '');
  base_uname := lower(regexp_replace(split_part(raw_email, '@', 1), '[^a-z0-9_]', '_', 'g'));

  -- Fallback for anonymous / social logins that arrive with no email
  if base_uname = '' then
    base_uname := 'user';
  end if;

  final_uname := base_uname;

  -- Guarantee uniqueness by appending a short random suffix when needed
  while exists (select 1 from public.user_profile where username = final_uname) loop
    suffix      := substr(md5(random()::text), 1, 4);
    final_uname := base_uname || '_' || suffix;
  end loop;

  insert into public.user_profile (user_id, username, display_name)
  values (
    new.id,
    final_uname,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(raw_email, '@', 1)
    )
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.provision_user_profile();
