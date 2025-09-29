-- 0) Safety
begin;

-- 1) New table for multi-images per card
create table if not exists public.card_images (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.cards(id) on delete cascade,

  -- seed/mapping from old image_cache
  legacy_key text unique,

  -- upstream + storage info
  source_url   text,
  url_hash     bytea,
  storage_path text,
  status text not null default 'PROCESSING' check (status in ('READY','PROCESSING','FAILED')),
  content_type text,
  width int,
  height int,
  bytes int,
  provider text,

  -- selection/ranking
  kind text check (kind in ('front','back','scan','photo','promo','other')) default 'photo',
  is_primary boolean not null default false,
  quality_score real default 0.0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_card_images_card_id on public.card_images(card_id);
create unique index if not exists idx_card_images_one_primary_per_card
  on public.card_images(card_id) where is_primary;

-- 2) Add new FK columns to cards (keep old ones for now)
alter table public.cards
  add column if not exists front_image_id uuid,
  add column if not exists back_image_id uuid,
  add column if not exists extra_image_ids uuid[] default '{}'::uuid[];

-- 3) Seed card_images from existing image_cache (adjust column names if needed)
insert into public.card_images (legacy_key, source_url, storage_path, status, content_type, width, height, bytes)
select ic.key, ic.source_url, ic.storage_path, coalesce(ic.status, 'READY'), ic.content_type, ic.width, ic.height, ic.bytes
from public.image_cache ic
on conflict (legacy_key) do nothing;

-- 4) Map cards.front_id/back_id (text keys) -> new UUIDs
update public.cards c
set front_image_id = ci.id
from public.card_images ci
where c.front_id is not null
  and c.front_id = ci.legacy_key;

update public.cards c
set back_image_id = ci.id
from public.card_images ci
where c.back_id is not null
  and c.back_id = ci.legacy_key;

-- 5) Map cards.extras (text[] keys) -> uuid[] ids
update public.cards c
set extra_image_ids = coalesce((
  select array_agg(ci.id)::uuid[]
  from unnest(c.extras) as k
  join public.card_images ci on ci.legacy_key = k
), '{}'::uuid[]);

-- 6) New FKs on the UUID columns
alter table public.cards
  add constraint cards_front_image_id_fkey foreign key (front_image_id) references public.card_images(id) on delete set null,
  add constraint cards_back_image_id_fkey  foreign key (back_image_id)  references public.card_images(id) on delete set null;

-- 7) Drop old FKs to image_cache (after data copied)
alter table public.cards drop constraint if exists cards_front_id_fkey;
alter table public.cards drop constraint if exists cards_back_id_fkey;

-- 8) (Optional) Drop old columns once app is updated
-- alter table public.cards drop column front_id, drop column back_id, drop column extras;

commit;
