import { HomeFeedSectionConfig } from '@/client/home/sections'
import { useExpandableSection } from '@/components/content-card'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { Heart } from 'lucide-react-native'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { HOME_FEED_SECTION_ICONS } from '../sectionIcons'
import { MOCK_WISHLIST_HITS } from './wishlistHits.mock'

// Design refs: Klarna's price list (refero.design/screens/b69ba734-0615-4769-bbed-9fbbc542d020)
// badges the price and pairs it with a second reference point; Target's deal cards
// (refero.design/screens/6c758c46-5199-4bbe-a6b9-05d061badcbf) badge the discount on the image
// and strike through the "was" price. No card wrapper here (unlike Collections/Sellers) — like
// Google Maps' hotel carousel (refero.design/screens/cccbe4d4-5588-45d1-8ebb-86d5bcf91a99),
// hierarchy comes from the shadowed image tile, badge, and price typography alone.
const ITEM_WIDTH = 120
const IMAGE_WIDTH = 96

function SavingsBadge({ percentOff }: { percentOff: number }) {
  if (percentOff <= 0) return null
  return (
    <View
      style={{
        backgroundColor: Colors.$backgroundSuccessLight,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text variant="stats" style={{ color: Colors.$textSuccess }}>
        -{Math.round(percentOff)}%
      </Text>
    </View>
  )
}

function PriceRow({
  wishlistPrice,
  currentPrice,
  isOpen,
}: {
  wishlistPrice: number
  currentPrice: number
  isOpen?: boolean
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
        justifyContent: isOpen ? 'flex-start' : 'center',
      }}
    >
      <Text
        variant={isOpen ? 'large' : 'default'}
        style={{ color: Colors.$textDefault, fontWeight: '700' }}
      >
        {formatPrice(currentPrice * 100)}
      </Text>
      <Text
        variant="small"
        style={{ color: Colors.$textNeutral, textDecorationLine: 'line-through' }}
      >
        {formatPrice(wishlistPrice * 100)}
      </Text>
    </View>
  )
}

export function useAvailableNowSection(config?: HomeFeedSectionConfig) {
  return useExpandableSection({
    icon: (config && HOME_FEED_SECTION_ICONS[config.icon]) ?? Heart,
    title: config?.title ?? 'Wishlist Hits',
    items: MOCK_WISHLIST_HITS,
    itemWidth: ITEM_WIDTH,
    expandable: config?.layout.expandable ?? true,
    containerClassNames: 'gap-6 px-6',
    renderItem: ({ item, isOpen }) => {
      const percentOff = ((item.wishlistPrice - item.currentPrice) / item.wishlistPrice) * 100
      return (
        <View
          style={
            isOpen
              ? { flexDirection: 'row', alignItems: 'center', gap: 16, width: '100%' }
              : { width: ITEM_WIDTH, alignItems: 'center' }
          }
        >
          <View style={{ position: 'relative' }}>
            <LiquidGlassCard
              variant="primary"
              style={{
                width: IMAGE_WIDTH,
                aspectRatio: 5 / 7,
                shadowColor: 'black',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 4,
              }}
            />
            <View style={{ position: 'absolute', top: 6, left: 6 }}>
              <SavingsBadge percentOff={percentOff} />
            </View>
          </View>

          <View style={isOpen ? { flex: 1, gap: 4 } : { marginTop: 8 }}>
            {isOpen && (
              <>
                <Text variant="large" numberOfLines={1} style={{ fontWeight: '600' }}>
                  {item.title}
                </Text>
                <Text variant="small" numberOfLines={1} style={{ color: Colors.$textNeutral }}>
                  {item.setName}
                </Text>
              </>
            )}
            <PriceRow
              wishlistPrice={item.wishlistPrice}
              currentPrice={item.currentPrice}
              isOpen={isOpen}
            />
            {isOpen && (
              <Text variant="small" style={{ color: Colors.$textNeutral }}>
                Listed by {item.ownerHandle}
              </Text>
            )}
          </View>
        </View>
      )
    },
  })
}
