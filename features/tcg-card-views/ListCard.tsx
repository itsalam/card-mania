import { useIsWishlisted, useToggleWishlist } from '@/client/card/wishlist'
import { usePrimaryPhoto } from '@/client/collections/photos'
import { Button } from '@/components/ui/button'
import { WishlistCard } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { cn } from '@/lib/utils/cn'
import { useRouter } from 'expo-router'
import { Layers, Maximize, TrendingDown, TrendingUp } from 'lucide-react-native'
import { forwardRef, ReactNode, useState } from 'react'
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import Svg, { Path } from 'react-native-svg'
import { CardTile } from '../../components/tcg-card/CardTile'
import { CARD_LIST_ROW_RADIUS, LIST_THUMBNAIL_WIDTH } from '../../components/tcg-card/consts'
import { glassSurfaceStyle } from '../../components/tcg-card/GlassCard'
import { GradeBadge } from '../../components/tcg-card/GradeBadge'
import { useNavigateToItem } from '../../components/tcg-card/helpers'
import { CardImage } from './card-image'
import { getCardDisplayData } from './helpers'
import { ItemListViewProps } from './types'

function GainBadge({ gain, value }: { gain: number; value: number }) {
  const isPositive = gain > 0
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {isPositive ? (
        <TrendingUp size={24} color={Colors.$textSuccess} />
      ) : (
        <TrendingDown size={24} color={Colors.$textDanger} />
      )}
      <View style={{ flexDirection: 'column', gap: 2 }}>
        <Text
          variant="default"
          style={{ color: isPositive ? Colors.$textSuccess : Colors.$textDanger }}
        >
          {isPositive ? '+' : ''}
          {formatPrice(value)}
        </Text>
        <Text
          variant="small"
          style={{
            color: isPositive ? Colors.$textSuccess : Colors.$textDanger,
            opacity: 0.7,
            alignSelf: 'flex-end',
          }}
        >
          {`(${gain.toFixed(1)}%)`}
        </Text>
      </View>
    </View>
  )
}

export const MainInfoAccessories = ({ displayData, gain, hide }: ItemListViewProps) => {
  return (
    <View className="flex-1 flex flex-col justify-start">
      {!hide?.price && (
        <View style={[styles.priceContainer]}>
          {displayData?.displayPrice ? (
            <Text
              className="text-4xl font-bold"
              style={{
                color: Colors.$textDefault,
              }}
            >
              {formatPrice(displayData.displayPrice * 100)}
            </Text>
          ) : (
            <Text
              className="text-4xl font-medium opacity-70"
              style={{
                color: Colors.$textDefault,
              }}
            >
              $-.--
            </Text>
          )}
          {displayData?.quantity && (
            <Text
              variant={'small'}
              className="font-medium opacity-70"
              style={{
                color: Colors.$textNeutralHeavy,
              }}
            >
              {` x Qty: ${displayData?.quantity}`}
            </Text>
          )}
          {typeof gain === 'number' && gain !== 0 && displayData?.displayPrice && (
            <GainBadge gain={gain} value={gain * displayData.displayPrice} />
          )}
        </View>
      )}
    </View>
  )
}

const ACCESSORY_ICON_SIZE = 16
/** A list row's corner radius inside its 1px glass border — what corner tabs round to. */
export const LIST_ROW_INNER_RADIUS = CARD_LIST_ROW_RADIUS - 1
/** The title tab's corner radius, and its inset from the item's top and right edges and the art. */
const TITLE_TAB_RADIUS = 8
const TITLE_TAB_INSET = 6

/**
 * Glass fill + outline for a list row whose top-right corner is notched around the title tab:
 * the item's top border steps down to the tab's top, runs over it, down its right side and
 * steps back out to the item's right edge — so the tab reads as set into the corner, 6px in from
 * the top and right, rather than covered by the item's border. Each step is an S-curve (the
 * shoulder cutout). The tab's own inner edges (left side, rounded bottom-left, bottom) are
 * stroked too, with its grey/white fill. Drawn behind the row's content in place of the row's
 * CSS border/background, since a CSS border can't be broken around the notch.
 */
function NotchedRowOutline({
  width: W,
  height: H,
  tabBottom: yb,
}: {
  width: number
  height: number
  /** y of the title tab's bottom edge, in row coordinates. */
  tabBottom: number
}) {
  const i = TITLE_TAB_INSET
  const a = i / 2
  const r = TITLE_TAB_RADIUS
  const Rr = CARD_LIST_ROW_RADIUS
  // Tab's left edge: past the art plus the inset gap.
  const tx = LIST_THUMBNAIL_WIDTH + i
  const tr = W - i
  // `o` insets the outer edges so a 1px stroke centred on them isn't clipped by the view.
  const silhouette = (o: number) =>
    [
      `M${Rr} ${o}`,
      `L${tx - i} ${o}`,
      // Step down to the tab's top.
      `A${a} ${a} 0 0 1 ${tx - a} ${a}`,
      `A${a} ${a} 0 0 0 ${tx} ${i}`,
      `L${tr - r} ${i}`,
      `A${r} ${r} 0 0 1 ${tr} ${i + r}`,
      `L${tr} ${yb - a}`,
      // Step back out to the item's right edge.
      `A${a} ${a} 0 0 0 ${tr + a} ${yb}`,
      `A${a} ${a} 0 0 1 ${W - o} ${yb + a}`,
      `L${W - o} ${H - Rr}`,
      `A${Rr - o} ${Rr - o} 0 0 1 ${W - Rr} ${H - o}`,
      `L${Rr} ${H - o}`,
      `A${Rr - o} ${Rr - o} 0 0 1 ${o} ${H - Rr}`,
      `L${o} ${Rr}`,
      `A${Rr - o} ${Rr - o} 0 0 1 ${Rr} ${o}`,
      'Z',
    ].join(' ')
  const tabFill = [
    `M${tx} ${i}`,
    `L${tr - r} ${i}`,
    `A${r} ${r} 0 0 1 ${tr} ${i + r}`,
    `L${tr} ${yb}`,
    `L${tx + r} ${yb}`,
    `A${r} ${r} 0 0 1 ${tx} ${yb - r}`,
    'Z',
  ].join(' ')
  // Inner edges, meeting the outer step-out curve at its midpoint.
  const tabInner = `M${tx} ${i} L${tx} ${yb - r} A${r} ${r} 0 0 0 ${tx + r} ${yb} L${tr + a} ${yb}`
  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={silhouette(0)} fill={Colors.rgba(Colors.$backgroundElevated, 0.45)} />
      <Path d={tabFill} fill={Colors.$backgroundElevated} />
      <Path d={tabFill} fill={Colors.rgba(Colors.$backgroundNeutral, 0.6)} />
      <Path d={silhouette(0.5)} fill="none" stroke={Colors.$outlineNeutral} strokeWidth={1} />
      <Path d={tabInner} fill="none" stroke={Colors.$outlineNeutral} strokeWidth={1} />
    </Svg>
  )
}
/** Inset of a list row's text content (the art and the action bar run edge to edge). */
export const ROW_CONTENT_PADDING = 12
// Each action is one half of a bar flush with the row's bottom and right edges (the row clips
// the corner), split by a hairline, instead of free-floating pills. flex: 1 + minWidth 0 because
// Button is shrink-0 by default. Colors resolve at render so the tokens follow the active theme.
// Fill sets the hierarchy: the bar reads as its own control strip below the row's info, with
// the primary action (Collection) tinted and the secondary (Wishlist) neutral until it's active,
// when it takes the toggle convention's active tint.
const accessoryButtonStyle = (tone: 'primary' | 'neutral' | 'active') => ({
  flex: 1,
  flexShrink: 1,
  minWidth: 0,
  minHeight: 44,
  borderRadius: 0,
  backgroundColor:
    tone === 'neutral'
      ? Colors.rgba(Colors.$backgroundNeutral, 0.6)
      : Colors.rgba(Colors.$backgroundPrimaryHeavy, tone === 'active' ? 0.35 : 0.2),
})
const actionBarBorder = () => Colors.rgba(Colors.$outlineNeutral, 0.4)

export const DefaultAccessories = ({
  renderButtons,
  ...props
}: ItemListViewProps & { renderButtons?: (props: ItemListViewProps) => ReactNode }) => {
  const { kind, item, displayData, gain } = props
  const toggleWishList = useToggleWishlist('card')
  const router = useRouter()

  const { data: wishlistedIds } = useIsWishlisted('card', item ? [item.id] : [])
  const isWishlisted = [...wishlistedIds?.values()].some((i) => i === item?.id)

  return (
    <View
      className="self-stretch flex-1 flex flex-col items-stretch justify-between relative"
      style={{ position: 'relative', alignSelf: 'stretch' }}
    >
      <View style={{ paddingHorizontal: ROW_CONTENT_PADDING }}>
        <MainInfoAccessories {...props} />
      </View>
      {renderButtons ? (
        renderButtons(props)
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'stretch',
            marginTop: 8,
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderColor: actionBarBorder(),
          }}
        >
          <Button
            // lg for its text-base label; className trims lg's padding back down for the bar.
            size="lg"
            variant="ghost"
            className="px-2 py-0 gap-1.5"
            style={[
              accessoryButtonStyle('primary'),
              { borderRightWidth: 1, borderColor: actionBarBorder() },
            ]}
            onPress={() => router.push(`cards/${item.id}/add-to-collection`)}
          >
            Collection
            <Layers color={Colors.$iconGeneral} size={ACCESSORY_ICON_SIZE} />
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="px-2 py-0 gap-1.5"
            style={accessoryButtonStyle(isWishlisted ? 'active' : 'neutral')}
            onPress={() => {
              item &&
                toggleWishList.mutate({
                  kind: kind ?? 'card',
                  id: item.id,
                  card: {
                    name: displayData?.title ?? '',
                    set_name: displayData?.subHeading,
                    latest_price: displayData?.displayPrice,
                    image_url: displayData?.imageProxyArgs?.directUrl,
                    grades_prices: (item as any).grades_prices ?? undefined,
                  },
                })
            }}
          >
            Wishlist
            <WishlistCard
              size={ACCESSORY_ICON_SIZE}
              color={Colors.$iconGeneral}
              fill={Colors.$iconGeneral}
            />
          </Button>
        </View>
      )}
    </View>
  )
}

export type CardListViewProps = { card: TCard & Partial<CollectionItemQueryView> } & Omit<
  ItemListViewProps,
  'item' | 'displayData'
>

export function CardListView({ card, collectionItem, ...props }: CardListViewProps) {
  // `collection_item_query` / `viewSingleCollectionItem` embed the item's primary photo
  // directly on `collectionItem` now (`primary_image_cache_id`, always `string | null`
  // rather than `undefined` when present) — skip the separate usePrimaryPhoto round trip
  // entirely when that's already available; getCardDisplayData reads it straight off
  // `collectionItem`. Only fall back to fetching when `collectionItem` predates the embed
  // (e.g. still sourced from `collection_items_by_ref`) or isn't passed at all.
  const hasEmbeddedPrimaryPhoto = collectionItem?.primary_image_cache_id !== undefined
  const { data: primaryPhoto, isLoading: primaryPhotoLoading } = usePrimaryPhoto(
    hasEmbeddedPrimaryPhoto ? undefined : collectionItem?.id
  )
  const displayData = getCardDisplayData({
    card,
    collectionItem,
    primaryPhoto,
    primaryPhotoLoading,
    metadata: card?.price_key ? { price_key: card?.price_key } : undefined,
    isLoading: props.isLoading,
  })

  //@ts-ignore
  return (
    <ItemListView
      item={card}
      collectionItem={collectionItem}
      displayData={displayData}
      {...props}
    />
  )
}

export const ItemListView = forwardRef<View, ItemListViewProps>(function ItemListView(
  { renderAccessories, navigateTo, imageAccessory, ...props },
  ref
) {
  const {
    item,
    kind = 'card',
    collectionItem,
    displayData,
    expanded = true,
    className,
    vertical = false,
    style,
    onPress,
  } = props

  const [pressed, setPressed] = useState(false)
  const [rowSize, setRowSize] = useState<{ width: number; height: number } | null>(null)
  const [tabBottom, setTabBottom] = useState<number | null>(null)
  const { cardElement, handlePress } = useNavigateToItem({
    kind,
    item: collectionItem ? collectionItem : item,
    path: navigateTo,
    paramName: navigateTo?.match(/\[([^\]]+)\]/)?.[1],
    params: collectionItem
      ? {
          cardId: collectionItem.ref_id,
          collectionId: collectionItem.collection_id,
          // Already resolved here (this list tile already rendered it) — hand it
          // off so DetailCardView can show the preferred photo immediately
          // instead of the vendor card image while its own fetch is in flight.
          ...(displayData?.imageProxyArgs.imageId
            ? { image: displayData.imageProxyArgs.imageId }
            : {}),
        }
      : undefined,
  })

  // Collapsed (e.g. Recently Viewed's carousel): the shared glass tile, with the art bare inside
  // it so there's one frame rather than CardImage's own glass card nested in the tile's.
  if (!expanded && !vertical) {
    const press = onPress ?? handlePress
    return (
      <CardTile
        title={displayData?.title}
        subtitle={displayData?.subHeading}
        badge={!props.hide?.grade && <GradeBadge priceKey={displayData?.metadata} />}
        price={displayData?.displayPrice ? displayData.displayPrice * 100 : null}
        changePercent={props.gain}
        isLoading={props.isLoading}
        onPress={press}
        renderArt={({ width, height }) => (
          <CardImage
            displayData={displayData}
            width={width}
            height={height}
            isLoading={props.isLoading}
            cardContainerStyle={{ borderRadius: 0 }}
            imageProps={{
              glassEffect: false,
              enableShadow: false,
              onPress: press,
              ref: cardElement,
            }}
          />
        )}
      />
    )
  }

  // Expanded horizontal rows (collection, storefront, marketplace, search, expanded home sections)
  // sit on the same glass surface as LiquidGlassCard, sized like the collapsed CardTile (same art
  // width, padding and radii) with the art bare inside; vertical tiles stay bare.
  const isListRow = !vertical && expanded
  const showExpand = imageAccessory === undefined && Boolean(item?.id)
  // Rows with the title tab draw their own notched outline (NotchedRowOutline) instead of the CSS
  // glass border, sized from the row's and the tab's measured layout.
  const notched = isListRow && showExpand

  return (
    <Pressable
      ref={ref}
      className={cn('items-start flex', vertical ? '' : 'flex-row w-full', className)}
      // Static style + tracked press state: a function-style Pressable `style` is dropped by
      // NativeWind's className interop, which silently removed the glass surface. The bordered glass
      // gives each entry a visible hit area, so taps near an edge don't land on the next card.
      style={[
        isListRow && [styles.listRow, !notched && glassSurfaceStyle()],
        style,
        { opacity: pressed ? 0.85 : 1 },
      ]}
      // With the expand tab shown, only the title and the tab open the item — the rest of the row
      // (art, entries, empty space) no longer navigates on a stray tap.
      onPressIn={showExpand ? undefined : () => setPressed(true)}
      onPressOut={showExpand ? undefined : () => setPressed(false)}
      onPress={showExpand ? undefined : (onPress ?? handlePress)}
      onLayout={
        notched
          ? (e) => {
              const { width, height } = e.nativeEvent.layout
              setRowSize({ width, height })
            }
          : undefined
      }
    >
      {notched && rowSize && tabBottom != null && (
        <NotchedRowOutline width={rowSize.width} height={rowSize.height} tabBottom={tabBottom} />
      )}
      <View
        style={[
          {
            position: 'relative',
            overflow: 'visible',
            alignSelf: 'stretch',
            alignContent: 'center',
            justifyContent: 'center',
          },
          vertical ? { padding: 8, paddingBottom: 0 } : {},
          // Art runs edge to edge on the row's left side; any height the text adds beyond the art
          // stays transparent (the row's glass shows through).
          isListRow && { justifyContent: 'flex-start' },
        ]}
      >
        <View style={vertical ? { marginHorizontal: 'auto' } : {}}>
          <CardImage
            displayData={displayData}
            width={isListRow ? LIST_THUMBNAIL_WIDTH : undefined}
            imageProps={{
              onPress: showExpand ? undefined : (onPress ?? handlePress),
              ref: cardElement,
              // List rows show bare art inside the row's glass, like CardTile does.
              ...(isListRow ? { glassEffect: false, enableShadow: false } : {}),
            }}
          />
          {!props.hide?.grade && displayData?.metadata && (
            <View style={{ position: 'absolute', bottom: 6, left: 6 }} pointerEvents="none">
              <GradeBadge priceKey={displayData.metadata} />
            </View>
          )}
          {!showExpand && imageAccessory}
        </View>
      </View>

      {expanded && !Boolean(vertical) ? (
        <HorizontalAccessory
          renderAccessories={renderAccessories}
          reserveExpandCorner={showExpand}
          onTitlePress={showExpand ? (onPress ?? handlePress) : undefined}
          titleLabel={`Open ${displayData?.title ?? 'card'}`}
          onTitleTabLayout={setTabBottom}
          {...props}
        />
      ) : (
        renderAccessories?.(props)
      )}
    </Pressable>
  )
})

function TitleBlock({ isLoading, displayData, hide }: ItemListViewProps) {
  if (isLoading) {
    return (
      <>
        <Skeleton style={{ height: 18, width: '80%', marginBottom: 6 }} />
        <Skeleton style={{ height: 14, width: '100%', marginBottom: 4 }} />
      </>
    )
  }
  return (
    <>
      {!hide?.title && (
        <Text
          variant={'large'}
          // Two lines keeps the text block within the art's height.
          numberOfLines={2}
          style={{
            color: Colors.$textDefault,
          }}
        >
          {displayData?.title}
        </Text>
      )}
      {!hide?.subtitle && (
        <Text
          variant={'muted'}
          className="capitalize"
          style={{
            color: Colors.$textNeutral,
          }}
        >
          {displayData?.subHeading}
        </Text>
      )}
    </>
  )
}

function HorizontalAccessory({
  reserveExpandCorner,
  onTitlePress,
  titleLabel,
  onTitleTabLayout,
  ...props
}: ItemListViewProps & {
  reserveExpandCorner?: boolean
  onTitlePress?: () => void
  titleLabel?: string
  /** Reports the title tab's bottom edge (row coordinates) for the row's notched outline. */
  onTitleTabLayout?: (bottom: number) => void
}) {
  const { renderAccessories } = props
  return (
    // flex-1 + minWidth 0 (not w-full, which is 100% of the row on top of the art's width) so the
    // column takes only the space beside the art and long titles wrap instead of overflowing.
    <View className="flex flex-col self-stretch items-start pr-0 flex-1" style={{ minWidth: 0 }}>
      {reserveExpandCorner ? (
        // Title + subtitle in a tab set into the item's top-right corner: inset from the top and
        // right edges and the art, with the row's outline notched around it (NotchedRowOutline
        // draws its border and grey/white fill). The expand icon sits inside; the whole tab is
        // the item's open target (the rest of the row doesn't navigate).
        <TouchableOpacity
          onPress={onTitlePress}
          accessibilityRole="button"
          accessibilityLabel={titleLabel}
          // The column starts at the row's top, so the tab's own bottom is its row y.
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout
            onTitleTabLayout?.(y + height)
          }}
          style={{
            alignSelf: 'stretch',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 6,
            marginTop: TITLE_TAB_INSET,
            marginLeft: TITLE_TAB_INSET,
            marginRight: TITLE_TAB_INSET,
            // Collection entries' top border runs along the tab's bottom.
            marginBottom: renderAccessories ? 0 : 4,
            paddingHorizontal: 10,
            paddingTop: 6,
            paddingBottom: 6,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <TitleBlock {...props} />
          </View>
          <Maximize size={12} color={Colors.$iconDefault} style={{ marginTop: 4 }} />
        </TouchableOpacity>
      ) : (
        <View
          className="self-stretch"
          style={{
            paddingHorizontal: ROW_CONTENT_PADDING,
            paddingTop: ROW_CONTENT_PADDING,
            paddingBottom: 4,
          }}
        >
          <TitleBlock {...props} />
        </View>
      )}

      {renderAccessories ? (
        // Custom accessories bring their own side padding; the row no longer pads their bottom.
        <View className="self-stretch flex-1" style={{ paddingBottom: ROW_CONTENT_PADDING }}>
          {renderAccessories(props)}
        </View>
      ) : (
        <DefaultAccessories {...props} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  listRow: { borderRadius: CARD_LIST_ROW_RADIUS, overflow: 'hidden' },
  buttonIcon: { width: 28, height: 28 },
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  priceContainer: {
    flexDirection: 'row',
    gap: 4,

    flexGrow: 0,
    flexShrink: 1,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
})
