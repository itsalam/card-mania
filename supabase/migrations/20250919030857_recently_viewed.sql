-- entity-agnostic "recently viewed" table
drop table if exists public.recent_views;

create table public.recent_views (
  user_id        uuid            not null references auth.users(id) on delete cascade,
  item_type      text            not null,                      -- e.g. 'card' | 'set' | 'seller'
  item_id        uuid            not null,                      -- id in the respective table
  viewed_at      timestamptz     not null default now(),        -- last view timestamp
  views          integer         not null default 1,            -- counter for deduped views
  meta           jsonb           null,                          -- optional extras (source, device, etc.)

  constraint recent_views_pk primary key (user_id, item_type, item_id)
);

-- fast “latest first” listing per user
create index recent_views_user_time_idx on public.recent_views (user_id, viewed_at desc);

-- optional: per-item popularity
create index recent_views_item_pop_idx on public.recent_views (item_type, item_id, viewed_at desc);

-- if you want a server-side helper:
create or replace function public.touch_recent_view(
  p_user_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_meta jsonb default null
)
returns void
language sql
security definer
as $$
  insert into public.recent_views (user_id, item_type, item_id, meta)
  values (p_user_id, p_item_type, p_item_id, p_meta)
  on conflict (user_id, item_type, item_id)
  do update set
    viewed_at = now(),
    views     = recent_views.views + 1,
    meta      = coalesce(excluded.meta, recent_views.meta);
$$;

select cron.schedule(
  'recently-viewed-cleanup',
  '0 0 * * 0', -- every Sunday at midnight
  $$
    delete from public.recent_views rv
    using (
    select user_id, item_type, item_id,
            row_number() over (partition by user_id order by viewed_at desc) rn
    from public.recent_views
    ) r
    where r.user_id = rv.user_id and r.item_type = rv.item_type and r.item_id = rv.item_id
    and r.rn > 200;
  $$
);

alter table public.recent_views enable row level security;

create policy "user can view own recents"
on public.recent_views
for select
using (user_id = auth.uid());

create policy "user can upsert own recents"
on public.recent_views
for insert with check (user_id = auth.uid());

create policy "user can update own recents"
on public.recent_views
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());