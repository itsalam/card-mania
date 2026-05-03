-- Backfill user_profile rows for any auth.users that pre-date the
-- on_auth_user_created trigger (added in 20260429000000).
-- Uses the same username-generation logic as provision_user_profile().

do $$
declare
  rec         record;
  raw_email   text;
  base_uname  text;
  final_uname text;
  suffix      text;
  attempts    int;
begin
  for rec in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    left join public.user_profile up on up.user_id = u.id
    where up.user_id is null
  loop
    raw_email  := coalesce(rec.email, '');
    base_uname := lower(regexp_replace(split_part(raw_email, '@', 1), '[^a-z0-9_]', '_', 'g'));

    if base_uname = '' then
      base_uname := 'user';
    end if;

    final_uname := base_uname;
    attempts    := 0;

    while exists (select 1 from public.user_profile where username = final_uname) loop
      attempts := attempts + 1;
      if attempts >= 20 then
        final_uname := base_uname || '_' || left(rec.id::text, 8);
        exit;
      end if;
      suffix      := substr(md5(random()::text), 1, 4);
      final_uname := base_uname || '_' || suffix;
    end loop;

    insert into public.user_profile (user_id, username, display_name)
    values (
      rec.id,
      final_uname,
      coalesce(
        rec.raw_user_meta_data ->> 'display_name',
        rec.raw_user_meta_data ->> 'full_name',
        split_part(raw_email, '@', 1)
      )
    )
    on conflict (user_id) do nothing;
  end loop;
end;
$$;
