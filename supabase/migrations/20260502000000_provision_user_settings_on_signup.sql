-- Provision a user_settings row whenever a user_profile row is inserted.
-- This piggybacks on the existing user_profile trigger chain:
--   auth.users insert → provision_user_profile() → user_profile insert → (this trigger)

create or replace function public.trg_user_profile_provision_settings()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.user_settings (user_id, onboarding_complete)
  values (new.user_id, false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_user_profile_provision_settings on public.user_profile;
create trigger trg_user_profile_provision_settings
  after insert on public.user_profile
  for each row execute function public.trg_user_profile_provision_settings();

-- Back-fill any existing user_profile rows that don't have a user_settings row yet.
insert into public.user_settings (user_id, onboarding_complete)
select up.user_id, false
from public.user_profile up
left join public.user_settings us on us.user_id = up.user_id
where us.user_id is null
on conflict (user_id) do nothing;
