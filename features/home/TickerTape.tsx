import { TICKER_DAYS, TickerItem, tickerName, useTickerItems } from '@/client/home/ticker'
import { CARD_ASPECT_RATIO } from '@/components/tcg-card/consts'
import { glassSurfaceStyle } from '@/components/tcg-card/GlassCard'
import { GradeBadge } from '@/components/tcg-card/GradeBadge'
import { useNavigateToItem } from '@/components/tcg-card/helpers'
import { FadeScrollView } from '@/components/ui/fade-scroll'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { useSetting } from '@/features/settings'
import { CardImage } from '@/features/tcg-card-views/card-image'
import { DisplayData } from '@/features/tcg-card-views/types'
import { BadgeCheck, SlidersHorizontal, TrendingDown, TrendingUp } from 'lucide-react-native'
import { Fragment, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
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
import Svg, { Path } from 'react-native-svg'
import { Colors } from 'react-native-ui-lib'

// Home ticker tape: 7-day price moves for cards the user owns or watches, each with a small
// card thumbnail and separated by hairline dividers, scrolling under Portfolio Summary. Static and swipeable under the OS reduce-motion setting; touching the
// tape pauses it; tapping an entry opens the card.
//
// Design refs: TradingView watchlist (https://mobbin.com/screens/7927fcd8-c7d7-4763-a0e8-bf25f38a1a5c)
// for the name · price · change-% entry format; Fidelity market futures
// (https://mobbin.com/screens/dc93b9c6-e354-4acb-a00c-540e78f8d921) for the compact horizontal
// quote row; TradingView quote header
// (https://mobbin.com/screens/644ed184-5002-4179-bdb3-7a69ddcdb03d) and Lightyear's status chips
// (https://mobbin.com/screens/1b2a74ed-950e-4617-8826-f2b347a85aaa) for the small inline "Owned"
// pill beside the price change. The "Price change" title sits in a shoulder tab rising from the
// band's top-left edge — the outward form of the app's ShoulderCutoutDescriptor backgrounds
// (Background.tsx) — which the home screen lifts into the empty space beside the breakdown's
// "View breakdown" chip.

const BAND_HEIGHT = 64
/** Marquee speed in px/s — slow enough to read a name and price while it moves. */
const SPEED = 20
const ENTRY_GAP = 28
/** Card thumbnail in each entry, sized to sit inside the band with ~11px above and below. */
const THUMB_HEIGHT = 42
const THUMB_WIDTH = Math.round(THUMB_HEIGHT * CARD_ASPECT_RATIO)
/** Prices and changes use the monospace stats face (as card detail prices do) so digits align. */
const NUMBER_FONT = 'SpaceMono'
/** Height of the shoulder tab rising from the band's top-left edge to hold the title. */
export const TICKER_SHOULDER_HEIGHT = 20
/** Radius of the tab's convex top-right corner and its concave join to the band's top. */
const SHOULDER_RADIUS = 8
const SHOULDER_PADDING_X = 4

/**
 * The band with an outward shoulder tab on its top-left. `fill` is the whole shape; `outline` is
 * its top edge (over the tab, down its right side, across the band) plus the bottom hairline —
 * the band is full-bleed, so no side borders. Strokes sit on half-pixel lines to stay crisp.
 */
function shoulderPaths(width: number, height: number, tabWidth: number) {
  const r = SHOULDER_RADIUS
  const h = TICKER_SHOULDER_HEIGHT
  const x = tabWidth
  const top = (o: number) =>
    `M 0 ${o} L ${x - r} ${o} ` +
    // convex top-right corner of the tab
    `A ${r} ${r} 0 0 1 ${x - o} ${r} L ${x - o} ${h - r} ` +
    // concave join into the band's top edge
    `A ${r} ${r} 0 0 0 ${x + r} ${h + o} L ${width} ${h + o}`
  return {
    fill: `${top(0)} L ${width} ${height} L 0 ${height} Z`,
    outline: `${top(0.5)} M 0 ${height - 0.5} L ${width} ${height - 0.5}`,
  }
}

/**
 * Glass band with a "Price change" shoulder tab on its top-left. The tab is laid out above the
 * band (the frame is TICKER_SHOULDER_HEIGHT + BAND_HEIGHT tall), so a parent can pull it up with
 * a negative top margin to tuck the tab into spare space above.
 */
function TickerFrame({
  children,
  style,
  accessibilityLabel,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const [width, setWidth] = useState(0)
  const [tabWidth, setTabWidth] = useState(0)
  const glass = glassSurfaceStyle()
  const height = TICKER_SHOULDER_HEIGHT + BAND_HEIGHT
  const paths = width && tabWidth ? shoulderPaths(width, height, tabWidth) : null

  return (
    <View
      style={[{ height }, style]}
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {paths && (
        <Svg width={width} height={height} style={{ position: 'absolute' }} pointerEvents="none">
          {/* Opaque base first: the glass fill is translucent, and the tab overlaps the
              breakdown card's bottom border, which would otherwise show through it. */}
          <Path d={paths.fill} fill={Colors.$backgroundDefault} />
          <Path d={paths.fill} fill={glass.backgroundColor} />
          <Path d={paths.outline} stroke={glass.borderColor} strokeWidth={1} fill="none" />
        </Svg>
      )}
      <View
        onLayout={(e) => setTabWidth(Math.ceil(e.nativeEvent.layout.width))}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: TICKER_SHOULDER_HEIGHT,
          paddingLeft: 8,
          paddingRight: SHOULDER_PADDING_X + SHOULDER_RADIUS / 2,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Text variant="stats" style={{ fontSize: 11, lineHeight: 13, color: Colors.$textNeutral }}>
          Price changes
        </Text>
        {/* Ticker feed settings (choose what the tape shows) — not built yet, so disabled. */}
        <Pressable
          disabled
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ticker settings"
          accessibilityHint="Coming soon"
          accessibilityState={{ disabled: true }}
          style={{ opacity: 0.4 }}
        >
          <SlidersHorizontal size={12} color={Colors.$iconDefault} />
        </Pressable>
      </View>
      <View
        style={{
          marginTop: TICKER_SHOULDER_HEIGHT,
          height: BAND_HEIGHT,
          overflow: 'hidden',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  )
}

/** Marks a ticker entry as a card from the user's own collection (vs. a wishlist watch). */
function OwnedBadge() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.5),
        backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.2),
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <BadgeCheck size={10} color={Colors.$textPrimary} />
      <Text variant="stats" style={{ fontSize: 10, lineHeight: 13, color: Colors.$textDefault }}>
        Owned
      </Text>
    </View>
  )
}

function ChangeLabel({ pct }: { pct: number | null }) {
  if (pct == null || pct === 0) {
    return (
      <Text
        style={{
          fontFamily: NUMBER_FONT,
          fontSize: 10,
          lineHeight: 13,
          color: Colors.$textNeutral,
        }}
      >
        {pct === 0 ? '0.0%' : '—'}
      </Text>
    )
  }
  // Same TrendingUp / TrendingDown icons as Portfolio Summary, CardTile and list rows.
  const up = pct > 0
  const color = up ? Colors.$textSuccess : Colors.$textDanger
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Icon size={10} color={color} />
      <Text style={{ fontFamily: NUMBER_FONT, fontSize: 10, lineHeight: 13, color }}>
        {`${Math.abs(pct).toFixed(1)}%`}
      </Text>
    </View>
  )
}

function TickerEntry({ item }: { item: TickerItem }) {
  const displayData = useMemo<DisplayData>(
    () => ({
      id: item.ref_id,
      imageId: item.ref_id,
      title: item.name ?? 'Card',
      imageProxyArgs: { variant: 'tiny', shape: 'card', cardId: item.ref_id, imageType: 'front' },
    }),
    [item.ref_id, item.name]
  )
  const { cardElement, handlePress } = useNavigateToItem({
    kind: 'card',
    item: { id: item.ref_id, name: item.name, set_name: item.set_name },
  })
  const isOwned = item.source === 'owned'
  const isGraded = item.price_key !== 'ungraded'
  return (
    <Pressable
      ref={cardElement}
      onPress={handlePress}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="button"
      accessibilityLabel={`${tickerName(item.name)}${isOwned ? ', owned' : ''}, ${formatPrice(
        item.current_cents
      )}, ${
        item.change_pct == null ? 'no change data' : `${item.change_pct}% over ${TICKER_DAYS} days`
      }`}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {/* Row layout lives on a plain View: Pressable's function-style isn't reliably applied
          through NativeWind's interop, which left the entry stacked vertically. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <CardImage
          displayData={displayData}
          width={THUMB_WIDTH}
          height={THUMB_HEIGHT}
          // Square corners: both the Card wrapper and the image round themselves by default.
          cardContainerStyle={{ borderRadius: 0 }}
          imageStyle={{ borderRadius: 0 }}
          imageProps={{ glassEffect: false, enableShadow: false, onPress: handlePress }}
        />
        <View>
          <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 15, maxWidth: 200 }}>
            {tickerName(item.name)}
          </Text>

          {isGraded && (
            // Hug its own width — as a column child it would otherwise stretch across the entry.
            <View style={{ alignSelf: 'flex-start' }}>
              <GradeBadge priceKey={item.price_key} />
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: NUMBER_FONT, fontSize: 15, lineHeight: 17 }}>
              {formatPrice(item.current_cents)}
            </Text>
            <ChangeLabel pct={item.change_pct} />
            {isOwned && <OwnedBadge />}
          </View>
        </View>
      </View>
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
      // Each entry is followed by a divider (the last one too), so entry · | · entry spacing
      // stays even across the seam where the marquee's second copy begins.
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ENTRY_GAP / 2,
        paddingRight: ENTRY_GAP / 2,
      }}
    >
      {items.map((item) => (
        <Fragment key={`${item.ref_id}-${item.price_key}`}>
          <TickerEntry item={item} />
          <View
            style={{
              width: 1,
              height: THUMB_HEIGHT,
              backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.6),
            }}
          />
        </Fragment>
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
      style={{ flex: 1, overflow: 'hidden', justifyContent: 'center' }}
      onTouchStart={() => cancelAnimation(offset)}
      onTouchEnd={() => loop(offset.value)}
      onTouchCancel={() => loop(offset.value)}
    >
      <Animated.View style={[{ flexDirection: 'row', paddingLeft: 16 }, animatedStyle]}>
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

  if (isLoading) {
    return (
      <TickerFrame style={style}>
        <View style={{ paddingHorizontal: 16 }}>
          <Skeleton style={{ height: 16, width: '70%', borderRadius: 999 }} />
        </View>
      </TickerFrame>
    )
  }
  if (!items.length) return null

  return (
    <TickerFrame style={style} accessibilityLabel={`Price moves over the last ${TICKER_DAYS} days`}>
      {reduceMotion ? (
        <FadeScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, alignItems: 'center' }}
        >
          <Entries items={items} />
        </FadeScrollView>
      ) : (
        <Marquee items={items} />
      )}
    </TickerFrame>
  )
}
