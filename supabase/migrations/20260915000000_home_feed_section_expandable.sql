-- ITS-107 (follow-up): drive whether a home feed section can expand from config
--
-- ExpandableCard now takes an `expandable` prop — when false, the section renders
-- as a rail only (no "See all"/chevron affordance, no expanded list state). This
-- is read from home_feed_section_meta.layout.expandable per section, defaulting
-- to true when absent (see each card component's own `?? true`/`?? false` fallback
-- for what happens before this migration/RPC value is available).
--
-- Suggested Sellers becomes unexpandable here — a flat rail of sellers to follow
-- doesn't need a full-list view the way Wishlist Hits/Collections do.

update public.home_feed_section_meta
set layout = layout || jsonb_build_object('expandable', true)
where key in ('wishlist_hits', 'collections');

update public.home_feed_section_meta
set layout = layout || jsonb_build_object('expandable', false)
where key = 'suggested_sellers';
