ALTER TABLE
    "public"."collections"
add
    column if not exists "is_storefront" boolean,
add
    column if not exists "hide_sold_items" boolean;