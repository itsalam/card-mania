import { useActivePromo } from '@/client/promos'
import { Text } from '@/components/ui/text/base-text'
import { chunkGridRows, GRID_GAP, GridCard, gridCellWidth } from '@/features/marketplace/GridCard'
import { useRouter } from 'expo-router'
import { X } from 'lucide-react-native'
import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
import { accentColor } from './accent'

const SIDE_PADDING = 16
const MAX_CONTENT_WIDTH = 720

/** "See all" for a promo: every card in its feed (up to 50), in the order the box shows them. */
export function PromoScreen({ id }: { id: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { data: promo, isLoading } = useActivePromo(id)

  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - SIDE_PADDING * 2
  const cellWidth = gridCellWidth(contentWidth)
  const items = (promo?.items ?? []).map((i) => ({ ...i, id: i.collection_item_id }))

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))

  return (
    <View style={{ flex: 1, backgroundColor: Colors.$backgroundDefault, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          paddingHorizontal: SIDE_PADDING,
          paddingVertical: 12,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="h4" numberOfLines={2}>
            {promo?.title ?? (isLoading ? '' : 'Promo')}
          </Text>
          {promo?.subtitle ? (
            <Text style={{ color: Colors.$textNeutral }} numberOfLines={2}>
              {promo.subtitle}
            </Text>
          ) : null}
          {promo ? (
            <Text variant="stats" style={{ color: accentColor(promo.accent) }}>
              {`${promo.item_count} card${promo.item_count === 1 ? '' : 's'} for sale`}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={close}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            padding: 8,
            borderRadius: 999,
            backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
            borderWidth: 1,
            borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
          }}
        >
          <X size={18} color={Colors.$iconDefault} />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={Colors.$iconNeutral} />
      ) : !promo || items.length === 0 ? (
        <Text style={{ color: Colors.$textNeutral, textAlign: 'center', marginTop: 32 }}>
          {promo ? 'No cards for sale yet. Check back after the release.' : 'This promo has ended.'}
        </Text>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SIDE_PADDING,
            paddingBottom: insets.bottom + 24,
            gap: GRID_GAP,
            width: '100%',
            maxWidth: MAX_CONTENT_WIDTH,
            alignSelf: 'center',
          }}
        >
          {chunkGridRows(items).map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: GRID_GAP }}>
              {row.map((item) => (
                <GridCard key={item.id} item={item} width={cellWidth} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
