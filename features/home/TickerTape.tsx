import { TICKER_DAYS, TickerItem, tickerName, useTickerItems } from '@/client/home/ticker'
import { glassSurfaceStyle } from '@/components/tcg-card/GlassCard'
import { GradeBadge } from '@/components/tcg-card/GradeBadge'
import { useNavigateToItem } from '@/components/tcg-card/helpers'
import { FadeScrollView } from '@/components/ui/fade-scroll'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { useSetting } from '@/features/settings'
import { useCallback, useEffect, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleProp, View, ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'

// Home ticker tape: 7-day price moves for cards the user owns (●) or watches (○), scrolling
// under Portfolio Summary. Static and swipeable under the OS reduce-motion setting; touching the
// tape pauses it; tapping an entry opens the card.
//
// Design refs: TradingView watchlist (https://mobbin.com/screens/7927fcd8-c7d7-4763-a0e8-bf25f38a1a5c)
// for the name · price · change-% entry format; Fidelity market futures
// (https://mobbin.com/screens/dc93b9c6-e354-4acb-a00c-540e78f8d921) for the compact horizontal
// quote row.

const BAND_HEIGHT = 36
/** Marquee speed in px/s — slow enough to read a price while it moves. */
const SPEED = 32
const ENTRY_GAP = 20

function ChangeLabel({ pct }: { pct: number | null }) {
  if (pct == null || pct === 0) {
    return (
      <Text style={{ fontSize: 12, lineHeight: 15, color: Colors.$textNeutral }}>
        {pct === 0 ? '0.0%' : '—'}
      </Text>
    )
  }
  const up = pct > 0
  return (
    <Text
      style={{
        fontSize: 12,
        lineHeight: 15,
        fontWeight: '700',
        color: up ? Colors.$textSuccess : Colors.$textDanger,
      }}
    >
      {`${up ? '▲' : '▼'}${Math.abs(pct).toFixed(1)}%`}
    </Text>
  )
}

function TickerEntry({ item }: { item: TickerItem }) {
  const { cardElement, handlePress } = useNavigateToItem({
    kind: 'card',
    item: { id: item.ref_id, name: item.name, set_name: item.set_name },
  })
  return (
    <Pressable
      ref={cardElement}
      onPress={handlePress}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="button"
      accessibilityLabel={`${tickerName(item.name)}, ${formatPrice(item.current_cents)}, ${
        item.change_pct == null ? 'no change data' : `${item.change_pct}% over ${TICKER_DAYS} days`
      }`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: 9, lineHeight: 12, color: Colors.$textNeutral }}>
        {item.source === 'owned' ? '●' : '○'}
      </Text>
      <Text
        numberOfLines={1}
        style={{ fontSize: 13, lineHeight: 16, fontWeight: '600', maxWidth: 160 }}
      >
        {tickerName(item.name)}
      </Text>
      {item.price_key !== 'ungraded' && <GradeBadge priceKey={item.price_key} />}
      <Text style={{ fontSize: 13, lineHeight: 16 }}>{formatPrice(item.current_cents)}</Text>
      <ChangeLabel pct={item.change_pct} />
    </Pressable>
  )
}

function Entries({
  items,
  onLayout,
}: {
  items: TickerItem[]
  onLayout?: (e: LayoutChangeEvent) => void
}) {
  return (
    <View
      onLayout={onLayout}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ENTRY_GAP,
        paddingRight: ENTRY_GAP,
      }}
    >
      {items.map((item) => (
        <TickerEntry key={`${item.ref_id}-${item.price_key}`} item={item} />
      ))}
    </View>
  )
}

function Marquee({ items }: { items: TickerItem[] }) {
  const [copyWidth, setCopyWidth] = useState(0)
  const offset = useSharedValue(0)

  const loop = useCallback(
    (from: number) => {
      if (!copyWidth) return
      const full = (copyWidth / SPEED) * 1000
      const remaining = ((copyWidth + from) / copyWidth) * full
      // Finish the current pass from wherever it was paused, snap back to 0 (the second copy
      // sits exactly where the first started, so the jump is invisible), then loop forever.
      offset.value = withSequence(
        withTiming(-copyWidth, { duration: remaining, easing: Easing.linear }),
        withTiming(0, { duration: 0 }),
        withRepeat(withTiming(-copyWidth, { duration: full, easing: Easing.linear }), -1, false)
      )
    },
    [copyWidth, offset]
  )

  useEffect(() => {
    offset.value = 0
    loop(0)
    return () => cancelAnimation(offset)
  }, [loop, offset])

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }))

  return (
    <View
      style={{ flex: 1, overflow: 'hidden' }}
      onTouchStart={() => cancelAnimation(offset)}
      onTouchEnd={() => loop(offset.value)}
      onTouchCancel={() => loop(offset.value)}
    >
      <Animated.View style={[{ flexDirection: 'row', paddingLeft: 14 }, animatedStyle]}>
        <Entries items={items} onLayout={(e) => setCopyWidth(e.nativeEvent.layout.width)} />
        {/* Second copy fills the gap as the first scrolls out, so the tape never empties. */}
        <Entries items={items} />
      </Animated.View>
    </View>
  )
}

export function TickerTape({ style }: { style?: StyleProp<ViewStyle> }) {
  const { data: items = [], isLoading } = useTickerItems()
  const reduceMotion = useSetting('reduceMotion').value

  const band: ViewStyle = {
    height: BAND_HEIGHT,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
    ...glassSurfaceStyle(),
  }

  if (isLoading) {
    return (
      <View style={[band, { paddingHorizontal: 14 }, style]}>
        <Skeleton style={{ height: 14, width: '70%', borderRadius: 999 }} />
      </View>
    )
  }
  if (!items.length) return null

  return (
    <View
      style={[band, style]}
      accessibilityLabel={`Price moves over the last ${TICKER_DAYS} days`}
    >
      {reduceMotion ? (
        <FadeScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 14 }}
        >
          <Entries items={items} />
        </FadeScrollView>
      ) : (
        <Marquee items={items} />
      )}
    </View>
  )
}
