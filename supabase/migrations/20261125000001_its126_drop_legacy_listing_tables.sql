-- ITS-126: drop the unused legacy marketplace tables from 20251002224319_collections_0.sql.
--
-- listings / listing_items / reservations / orders / order_items predate the storefront +
-- offers model. No app code, RPC, view or edge function reads them. The only reference was
-- the `listing` branch of wishlist_validate_fk, a function no trigger uses (and the
-- item_kind enum has no 'listing' value), so it goes too. Checkout tables will be designed
-- under the Payments epic (ITS-146 / ITS-197).
--
-- Refuses to run if any of them holds rows, so nothing is lost silently.

do $$
declare
  v_table text;
  v_rows bigint;
begin
  foreach v_table in array array['listings', 'listing_items', 'reservations', 'orders', 'order_items'] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('select count(*) from public.%I', v_table) into v_rows;
      if v_rows > 0 then
        raise exception 'ITS-126: public.% has % rows; not dropping legacy tables', v_table, v_rows;
      end if;
    end if;
  end loop;
end;
$$;

drop table if exists public.order_items;
drop table if exists public.orders;
drop table if exists public.reservations;
drop table if exists public.listing_items;
drop table if exists public.listings;

drop function if exists public.wishlist_validate_fk();
