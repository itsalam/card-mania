-- 20260909000000_home_feed_section_meta.sql already shipped (including to the linked remote
-- project), so its seed values aren't edited in place — this follow-up bumps
-- suggested_sellers' rail sizing to fit the new per-seller Follow button (20260910000000).
update public.home_feed_section_meta
set layout = jsonb_build_object('itemWidth', 92, 'collapsedHeight', 132, 'expandedHeight', 276),
    updated_at = now()
where key = 'suggested_sellers';
