-- Upsert a minimal cards record for vendor-sourced cards before they can be
-- referenced by collection_items / wishlist. Idempotent — never overwrites an
-- existing record. Optionally records the vendor mapping in external_refs.
create or replace function public.ensure_card_stub(
  p_id          uuid,
  p_name        text,
  p_set_name    text    default '',
  p_genre       text    default 'trading_card',
  p_provider    text    default null,
  p_external_id text    default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cards (id, name, set_name, genre)
  values (p_id, p_name, coalesce(p_set_name, ''), coalesce(p_genre, 'trading_card'))
  on conflict (id) do nothing;

  if p_provider is not null and p_external_id is not null then
    insert into public.external_refs (provider, external_id, card_id, suggested_uuid)
    values (p_provider, p_external_id, p_id, p_id)
    on conflict (provider, external_id) do nothing;
  end if;
end;
$$;

grant execute on function public.ensure_card_stub(uuid, text, text, text, text, text) to authenticated;
