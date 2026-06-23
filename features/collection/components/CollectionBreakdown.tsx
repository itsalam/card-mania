'use client'
import { useCollectionTotal, useWishlistTotal } from '@/client/collections/query'
import { Text } from '@/components/ui/text/base-text'
import { formatCompactPrice } from '@/components/utils'
import { cn } from '@/lib/utils'
import { MotiView } from 'moti'
import { useMemo } from 'react'
import { Pressable, StyleProp, View, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { DefaultCollectionData } from '../helpers'

const LABEL_TO_TYPE: Record<string, string> = {
  WISHLIST: 'wishlist',
  SELLING: 'selling',
  PORTFOLIO: 'vault',
}

export default function CollectionBreakdown({
  style,
  className,
  selectedCollections,
  onToggleCollection,
}: {
  title?: string
  style?: StyleProp<ViewStyle>
  className?: string
  selectedCollections?: string[]
  onToggleCollection?: (type: string) => void
}) {
  const { data: wishlistTotal } = useWishlistTotal()
  const { data: sellingTotal } = useCollectionTotal({ collectionType: 'selling' })
  const { data: portfolioTotal } = useCollectionTotal({ collectionType: 'vault' })

  const _selected = selectedCollections ?? ['wishlist', 'selling', 'vault']
  const _onToggle = onToggleCollection ?? (() => {})

  const { items, grandTotal } = useMemo(() => {
    const total = (wishlistTotal ?? 0) + (sellingTotal ?? 0) + (portfolioTotal ?? 0)
    return {
      items: [
        { ...DefaultCollectionData[0], current: wishlistTotal ?? 0, target: total },
        { ...DefaultCollectionData[1], current: sellingTotal ?? 0, target: total },
        { ...DefaultCollectionData[2], current: portfolioTotal ?? 0, target: total },
      ],
      grandTotal: total,
    }
  }, [wishlistTotal, sellingTotal, portfolioTotal])

  return (
    <View className={cn('w-full', className)} style={[{ gap: 10 }, style]}>
      {/* Segmented allocation bar */}
      <View
        style={{
          flexDirection: 'row',
          height: 6,
          borderRadius: 99,
          overflow: 'hidden',
          backgroundColor: Colors.$backgroundNeutral,
          gap: 2,
        }}
      >
        {items.map((item) => {
          const collectionType = LABEL_TO_TYPE[item.label]
          const isSelected = _selected.includes(collectionType)
          const flex = grandTotal > 0 ? item.current / grandTotal : 1 / items.length
          return (
            <MotiView
              key={item.label}
              animate={{ opacity: isSelected ? 1 : 0.15 }}
              transition={{ type: 'timing', duration: 200 }}
              style={{ flex, backgroundColor: item.colors[0] }}
            />
          )
        })}
      </View>

      {/* 3-column legend */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {items.map((item) => {
          const collectionType = LABEL_TO_TYPE[item.label]
          const isSelected = _selected.includes(collectionType)
          const pct = grandTotal > 0 ? Math.round((item.current / grandTotal) * 100) : 0
          return (
            <Pressable
              key={item.label}
              onPress={() => _onToggle(collectionType)}
              style={{ flex: 1, opacity: isSelected ? 1 : 0.4 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    backgroundColor: item.colors[0],
                  }}
                />
                <Text variant="stats" style={{ color: Colors.$textNeutral }}>
                  {item.label}
                </Text>
              </View>
              <Text
                variant="small"
                style={{ color: item.colors[1], fontWeight: '600', paddingLeft: 12 }}
              >
                {formatCompactPrice(item.current)}
              </Text>
              <Text variant="stats" style={{ color: Colors.$textNeutral, paddingLeft: 12 }}>
                {pct}%
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
