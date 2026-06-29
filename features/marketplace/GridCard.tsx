import { useImageProxy } from '@/client/image-proxy'
import { CARD_ASPECT_RATIO } from '@/components/consts'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { useRouter } from 'expo-router'
import { Image } from 'expo-image'
import React from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { type FeaturedCardItem } from './FeaturedCard'

export function GridCard({ item, width }: { item: FeaturedCardItem; width: number }) {
  const router = useRouter()
  const isGraded = Boolean(item.grading_company) && item.price_key !== 'ungraded'
  const imageHeight = Math.round(width / CARD_ASPECT_RATIO)

  const { data: imageData } = useImageProxy({
    variant: 'tiny',
    shape: 'card',
    cardId: item.ref_id,
    imageType: 'front',
  })

  return (
    <TouchableOpacity
      style={{ width }}
      activeOpacity={0.82}
      onPress={() =>
        router.push({ pathname: '/cards/[cardId]', params: { cardId: item.ref_id } } as any)
      }
    >
      {/* Card image — explicit dimensions, no external component with default sizing */}
      <View style={[styles.imageContainer, { width, height: imageHeight }]}>
        {imageData?.url ? (
          <Image
            source={{ uri: imageData.url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
      </View>

      <View style={styles.info}>
        {isGraded && (
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{item.grading_company}</Text>
            </View>
            <View style={[styles.chip, styles.chipAccent]}>
              <Text style={[styles.chipText, styles.chipAccentText]}>{item.price_key}</Text>
            </View>
          </View>
        )}

        <Text style={styles.price}>{formatPrice(item.market_value)}</Text>

        <Text style={styles.title} numberOfLines={2}>
          {item.name}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  imageContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.$backgroundElevated,
  },

  info: {
    paddingTop: 8,
    gap: 4,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.1),
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.25),
  },
  chipAccent: {
    backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.15),
    borderColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.4),
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: Colors.$textNeutral,
  },
  chipAccentText: {
    color: Colors.$backgroundPrimaryHeavy,
  },

  price: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.$textDefault,
  },
  title: {
    fontSize: 12,
    color: Colors.$textNeutral,
    lineHeight: 16,
  },
})
