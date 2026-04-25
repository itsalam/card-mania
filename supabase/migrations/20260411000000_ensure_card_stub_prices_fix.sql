-- Prevent ensure_card_stub from overwriting an existing card's grades_prices
-- with an empty object when no prices are supplied by the caller.
-- latest_price is also coalesced so a null incoming value never clears an existing one.
create or replace function public.ensure_card_stub(
  p_id            uuid,
  p_name          text,
  p_set_name      text    default '',
  p_genre         text    default 'trading_card',
  p_grades_prices jsonb   default '{}',
  p_latest_price  numeric default null,
  p_image_url     text    default null,
  p_provider      text    default null,
  p_external_id   text    default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_image_id uuid;
begin
  insert into public.cards (id, name, set_name, genre, grades_prices, latest_price)
  values (
    p_id,
    p_name,
    coalesce(p_set_name, ''),
    coalesce(p_genre, 'trading_card'),
    coalesce(p_grades_prices, '{}'),
    p_latest_price
  )
  on conflict (id) do update set
    -- Only overwrite grades_prices when the caller actually supplies prices;
    -- an empty object means "no data" and must not erase existing prices.
    grades_prices = case
      when excluded.grades_prices = '{}'::jsonb then cards.grades_prices
      else excluded.grades_prices
    end,
    -- Preserve an existing latest_price when the caller passes null.
    latest_price  = coalesce(excluded.latest_price, cards.latest_price),
    last_updated  = now();

  if p_image_url is not null then
    if not exists (
      select 1 from public.card_images where card_id = p_id and is_primary
    ) then
      insert into public.card_images (card_id, source_url, status, kind, is_primary)
      values (p_id, p_image_url, 'READY', 'front', true)
      returning id into v_image_id;
    end if;

    update public.cards
      set front_image_id = coalesce(
        v_image_id,
        (select id from public.card_images where card_id = p_id and is_primary limit 1)
      )
    where id = p_id and front_image_id is null;
  end if;

  if p_provider is not null and p_external_id is not null then
    insert into public.external_refs (provider, external_id, card_id, suggested_uuid)
    values (p_provider, p_external_id, p_id, p_id)
    on conflict (provider, external_id) do nothing;
  end if;
end;
$$;

grant execute on function public.ensure_card_stub(uuid, text, text, text, jsonb, numeric, text, text, text) to authenticated;
