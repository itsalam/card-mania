import { HomeFeedSectionConfig } from '@/client/home/sections'
import { useExpandableSection } from '@/components/content-card'
import { Text } from '@/components/ui/text/base-text'
import { CollectionsListItem } from '@/features/collection/components/ListItem'
import { useMyCollections } from '@/lib/store/functions/hooks'
import { Layers } from 'lucide-react-native'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { HOME_FEED_SECTION_ICONS } from '../sectionIcons'

// CollectionsListItem wraps the collapsed item in a rounded card with 12px padding on every
// edge — accounted for here so the rail's snap width matches the padded card, not just its
// inner content.
const COLLAPSED_CARD_PADDING = 12

// Wide enough to fit a ~20-30 character collection title on one line at the `small` text
// variant (14px) without truncating. This widens the collapsed item's *footprint* (text
// width + rail snap interval) only — the preview icon itself stays at the small `itemWidth`
// basis (see `collapsedIconWidth` below), it's just centered within the wider column.
const DEFAULT_COLLAPSED_WIDTH = 220

// Slightly smaller than the old THUMBNAIL_WIDTH (96) basis — the icon was competing with the
// title/description text for attention, especially once expanded.
const DEFAULT_ITEM_WIDTH = 80

export function useCollectionsPreviewSection(config?: HomeFeedSectionConfig) {
  const { data: collections } = useMyCollections()
  // Small basis: the preview icon's actual rendered size, collapsed and (via EXPANDED_ICON_SCALE,
  // see ListItem.tsx) expanded.
  const itemWidth = config?.layout.itemWidth ?? DEFAULT_ITEM_WIDTH
  // Wide basis: the collapsed item's overall column width (text + rail snap interval) — kept
  // independent of itemWidth so the icon doesn't grow just to make room for a longer title.
  const collapsedWidth = config?.layout.collapsedWidth ?? DEFAULT_COLLAPSED_WIDTH
  const items = config?.result_limit
    ? (collections ?? []).slice(0, config.result_limit)
    : (collections ?? [])

  return useExpandableSection({
    icon: (config && HOME_FEED_SECTION_ICONS[config.icon]) ?? Layers,
    title: config?.title ?? 'Collections',
    // Matches the item's actual (wide) collapsed footprint — including the rounded card's own
    // padding — so horizontal scroll snapping lands on item boundaries, not the (narrower)
    // icon or unpadded content width.
    itemWidth: collapsedWidth + COLLAPSED_CARD_PADDING * 2,
    expandable: config?.layout.expandable ?? true,
    // CollectionsPreviewIcon's own box is `width + 40` (room for its fanned-card rotation),
    // wider than the nominal itemWidth — the rail's default gap-x-2.5 isn't enough clearance
    // between two of those wider boxes, so adjacent stacks visually crowd each other.
    containerClassNames: 'gap-x-6',
    items,
    renderItem: ({ item, isOpen }) => {
      const count = item.collection_items?.[0]?.count ?? 0
      return (
        // cardWidth alone (no collapsedIconWidth override) keeps the icon at the small basis
        // in both states — itemWidth collapsed, itemWidth * EXPANDED_ICON_SCALE expanded.
        <CollectionsListItem isOpen={isOpen} cardWidth={itemWidth}>
          <View
            style={
              // Collapsed rail: text centered under the (small) icon, in the wider column.
              // Expanded list row: original left-aligned, flexed layout, indented past the
              // divider CollectionsListItem renders between the icon and this column.
              isOpen
                ? { justifyContent: 'center', gap: 2, flex: 1, paddingLeft: 12 }
                : { alignItems: 'center', gap: 2, width: collapsedWidth }
            }
          >
            <Text
              variant={isOpen ? 'h4' : 'small'}
              numberOfLines={1}
              style={isOpen ? { fontWeight: '700' } : { textAlign: 'center' }}
            >
              {item.name}
            </Text>
            <Text variant="stats" style={{ color: Colors.$textNeutral }}>
              {count} {count === 1 ? 'card' : 'cards'}
            </Text>
            {isOpen && item.description && (
              <Text variant="small" numberOfLines={2} style={{ color: Colors.$textNeutral }}>
                {item.description}
              </Text>
            )}
          </View>
        </CollectionsListItem>
      )
    },
  })
}
