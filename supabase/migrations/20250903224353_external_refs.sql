-- Map any vendor id to your internal card
create table if not exists public.external_refs (
  provider    text not null,
  external_id text not null,
  card_id     uuid not null references public.cards(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (provider, external_id)
);

create index if not exists idx_external_refs_card_id on public.external_refs(card_id);

-- (Optional) store a stable v5 UUID you *would* use if creating a new card
alter table public.external_refs
  add column if not exists suggested_uuid uuid;

create or replace function public.resolve_external_refs(p_provider text, p_ids text[])
returns table (external_id text, card_id uuid)
language sql stable as $$
  select ids.external_id, er.card_id
  from unnest(p_ids) as ids(external_id)
  left join public.external_refs er
    on er.provider = p_provider and er.external_id = ids.external_id
$$;