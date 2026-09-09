import { useIsWishlisted, useToggleWishlist } from '@/client/card/wishlist'
import { CollectionItem } from '@/client/collections/types'
import { ShoulderCutoutDescriptor } from '@/components/Background'
import { CollectionItemPhotosModal } from '@/components/collections/items/photos-modal'
import DraggableFooter from '@/components/DraggableFooter'
import { AppStandaloneHeader, HEADER_ROW_H, PILL_R } from '@/components/ui/headers'
import { Modal } from '@/components/ui/modal'
import { Swapper } from '@/components/ui/swapper'
import { Text } from '@/components/ui/text'
import { formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { CART_BUTTON_HEIGHT, CartCountBadge } from '@/features/cart/CartButtonContent'
import { useCartCount, useOpenCart } from '@/features/cart/hooks'
import { getGradingDisplayString } from '@/features/collection/helpers'
import { ModifyCollectionHeader } from '@/features/collection/pages/modify-collection'
import {
  Check,
  EllipsisVertical,
  FolderHeart,
  Heart,
  Image as ImageIcon,
  RotateCcw,
  ShoppingCart,
} from 'lucide-react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  SharedValue,
  useSharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
import { CardImage } from '../../card-image'
import { DisplayData } from '../../types'
import { useCardDetails } from '../provider'

// Baseline horizontal breathing room for the collapsed footer row — added on top of the device's
// own left/right safe-area inset (usually 0 in portrait, but non-zero e.g. in landscape on a
// notched device) rather than replaced by it, so the row never collapses back down to a bare
// inset value on those devices.
const FOOTER_ROW_EXTRA_PADDING = 24

export const Footer = ({
  card,
  onLockedChange,
  isOwnCollectionItem,
  collectionItemId,
  displayData,
  collectionItem,
}: {
  card?: TCard
  onLockedChange?: (v: boolean) => void
  /** True only when the signed-in user owns this collection item — swaps Cart for Menu. */
  isOwnCollectionItem?: boolean
  collectionItemId?: string
  /** Already computed by DetailCardView/index.tsx (same card + collectionItem it fetches for
   *  the rest of the screen) — passed down rather than re-fetched here. Drives the collapsed
   *  footer's thumbnail/price/quantity. */
  displayData?: DisplayData | null
  /** Same reasoning as displayData — used here only for its grade_condition/grading_company,
   *  which DisplayData doesn't carry. */
  collectionItem?: CollectionItem | null
}) => {
  const {
    footerFullView,
    setFooterFullView,
    currentPage: page,
    footerPages: pages,
    pendingRollback,
    heroImageReady,
  } = useCardDetails()
  const [rollingBack, setRollingBack] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [photosModalOpen, setPhotosModalOpen] = useState(false)
  const { data: wishlistSet } = useIsWishlisted('card', [card?.id].filter(Boolean) as string[])
  const toggleWishlist = useToggleWishlist('card')
  const prevPage = useRef<number>(page)
  const cartCount = useCartCount()
  const openCart = useOpenCart()
  const insets = useSafeAreaInsets()
  const footerRowHorizontalPadding = Math.max(insets.left, insets.right) + FOOTER_ROW_EXTRA_PADDING

  // Ported from add-card.tsx's shoulder-cutout pill — same animated-width pill + matching
  // background void, so the "Save Card To" page's rollback/confirm pill reads identically to
  // the add-card search screen's. Unlike add-card.tsx (which owns its own rollback diffing and
  // can start the spring synchronously inside recompute()), pendingRollback here is computed by
  // AddToCollectionsView and only reaches this component via useCardDetails() context, so the
  // spring is instead kicked off reactively whenever pendingRollback's presence changes.
  const pillWSv = useSharedValue(0)
  const narrowWidthRef = useRef(0)
  const wideWidthRef = useRef(0)
  const shoulderCutout = useMemo<ShoulderCutoutDescriptor>(
    () => ({
      pillWSv: pillWSv as SharedValue<number>,
      headerHeight: HEADER_ROW_H,
      cornerR: PILL_R,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  useEffect(() => {
    if (pendingRollback) {
      if (wideWidthRef.current > 0) pillWSv.value = wideWidthRef.current
    } else if (narrowWidthRef.current > 0) {
      pillWSv.value = narrowWidthRef.current
    }
  }, [pendingRollback, pillWSv])

  useEffect(() => {
    prevPage.current = page
  }, [page])

  const isWishlisted = Boolean(card && wishlistSet?.has?.(card.id))
  const gradeLabel = getGradingDisplayString(collectionItem ?? undefined).join(' ')
  const priceLabel =
    displayData?.displayPrice != null ? formatPrice(displayData.displayPrice) : '--.--'
  const quantity = displayData?.quantity

  return (
    <>
      <DraggableFooter
        toggleLocked={footerFullView}
        onLockedChange={(l) => {
          setFooterFullView(l)
          onLockedChange?.(l)
        }}
        // Floats the drag thumb over the header instead of it claiming its own row above —
        // applies to every page's header here (Save Card To, Create Collection), since they all
        // share this one DraggableFooter/thumb.
        absoluteThumb
        // Slides the footer (and the pinned bar, same spring) up into place on first mount
        // instead of it already sitting there.
        animateEntrance
        // ...timed to start the moment the hero image's own animateFrom→animateTo transition
        // STARTS (DetailCardView/index.tsx's CardDetailContainer, heroImageReady), not once it
        // finishes — waiting for the ~839ms-later "landed" signal made this read as a sequential
        // "wait, then react" instead of one coordinated motion. Shared through CardDetailsStore
        // since Footer is a sibling of that component, not a descendant.
        entranceReady={heroImageReady}
        // Only attach while the "Save Card To" page's cutout pill is actually showing — passing
        // this the rest of the time would leave the background's void notch drawn from a stale
        // pillWSv even after the pill itself unmounts (e.g. on the Create Collection page).
        reverseExpand
        shoulderCutout={footerFullView && page === 0 ? shoulderCutout : undefined}
        // Animates this pinned bar to look like the sheet container once it opens above it — a
        // fading-in background, a matching top border/radius, and its own extra bottom padding.
        // See pinnedBarMatchesSheet's own comment in ThumbProps for what this covers.
        pinnedBarMatchesSheet
        mainContent={
          // Spotify-style mini-player row: a small "now viewing" summary on the left (image
          // + grade + price/qty, tap to expand into the full Collection view), bare
          // icon-only action buttons on the right — no bordered/pill buttons here, unlike
          // the rest of this app's button convention, deliberately mirroring a mini-player
          // bar rather than a toolbar. Stays mounted and visible regardless of footerFullView —
          // it's the pinned bar's permanent content now, not swapped out for the page
          // title/cutout when expanded (that moved into the sheet's own content, above
          // FooterDetails, below). Its own bottom padding is handled entirely by
          // DraggableFooter's pinnedBarMatchesSheet effect now — no padding here.
          <Animated.View
            style={{
              // minHeight, not height — a fixed height smaller than content (44px CardImage) +
              // paddingVertical (24px) forces the image to overflow past the padding box,
              // visually eating the top padding entirely. minHeight keeps the "at least as tall
              // as the floating cart button" intent while letting content+padding win when they
              // need more room (they do: 44 + 24 = 68).
              minHeight: CART_BUTTON_HEIGHT,
              paddingHorizontal: footerRowHorizontalPadding,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <TouchableOpacity
              onPress={() => setFooterFullView(!footerFullView)}
              style={{
                flex: 1,
                minWidth: 0,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <CardImage
                displayData={displayData ?? null}
                height={CART_BUTTON_HEIGHT}
                cardContainerStyle={{ borderRadius: 6 }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  variant={'stats'}
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: Colors.$textDefault,
                    textTransform: 'uppercase',
                  }}
                >
                  {gradeLabel}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 14, color: Colors.$textNeutral }}>
                  {quantity ? `${priceLabel} · Qty: ${quantity}` : priceLabel}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
              <TouchableOpacity
                onPress={() => setFooterFullView(!footerFullView)}
                hitSlop={10}
                accessibilityLabel="Collection"
              >
                <FolderHeart size={22} color={Colors.$iconDefault} />
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!card}
                onPress={() => card && toggleWishlist.mutate({ kind: 'card', id: card.id })}
                hitSlop={10}
                accessibilityLabel="Wishlist"
                style={{ opacity: card ? 1 : 0.4 }}
              >
                <Heart
                  size={22}
                  color={Colors.$iconDefault}
                  fill={isWishlisted ? Colors.$iconDefault : 'transparent'}
                />
              </TouchableOpacity>
              {isOwnCollectionItem && collectionItemId ? (
                <TouchableOpacity
                  onPress={() => setMenuOpen(true)}
                  hitSlop={10}
                  accessibilityLabel="Menu"
                >
                  <EllipsisVertical size={22} color={Colors.$iconDefault} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={openCart}
                  hitSlop={10}
                  accessibilityLabel="Open cart"
                  style={{ position: 'relative' }}
                >
                  <ShoppingCart size={22} color={Colors.$iconDefault} />
                  {cartCount > 0 && (
                    <View pointerEvents="none" style={{ position: 'absolute', top: -6, right: -8 }}>
                      <CartCountBadge count={cartCount} />
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        }
      >
        {/* Title/cutout now lives at the top of the sheet's own content — above FooterDetails —
            instead of swapped into the pinned bar (see mainContent's own comment). It fades with
            the rest of the sheet's content (detailContentStyle in DraggableFooter), so no
            separate mount/unmount gating beyond the page-existing check is needed here.
            page === 0 only — the Create Collection page (page 1) now renders ModifyCollectionView
            wholesale (see create-collection.tsx), which brings its own header (back-chevron +
            title); showing this shared one too would stack two headers/back buttons. */}
        {page === 0 && (
          // No flex-1 here — this wrapper sits in DraggableFooter's column-flex content
          // container alongside FooterDetails below; flex-1 on the header made it (wrongly)
          // claim all the remaining vertical space meant for FooterDetails' own content, instead
          // of just sizing to its own single row. FooterDetails carries flex-1 now instead.
          <Animated.View
            key={`footer-header-${page}`}
            className="w-full flex flex-row"
            entering={
              page > (prevPage.current ?? -Infinity) ? FadeInRight.delay(75) : FadeInLeft.delay(75)
            }
            exiting={page > (prevPage.current ?? -Infinity) ? FadeOutLeft : FadeOutRight}
          >
            <AppStandaloneHeader
              style={{ flex: 1 }}
              // No cutout pill outside page 0 — nothing needs the right-side reservation there,
              // and this header uses `children` (flex-start layout), not a centered `title`, so
              // there's no centering counterweight to preserve either. See hideRightSlot's own
              // doc for why this can't just be the default everywhere.
              hideRightSlot={page !== 0}
              onCutoutSize={(w) => {
                pillWSv.value = w
                if (pendingRollback) {
                  wideWidthRef.current = w
                } else {
                  narrowWidthRef.current = w
                }
              }}
              cutout={
                page === 0
                  ? {
                      onPress: () => setFooterFullView(false),
                      pillWSv,
                      height: HEADER_ROW_H,
                      content: (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          {pendingRollback && (
                            <>
                              <TouchableOpacity
                                disabled={rollingBack}
                                onPress={async () => {
                                  setRollingBack(true)
                                  await pendingRollback.execute()
                                  setRollingBack(false)
                                }}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 5,
                                  opacity: rollingBack ? 0.5 : 1,
                                }}
                              >
                                {/* count badge */}
                                <View
                                  style={{
                                    backgroundColor: Colors.rgba(Colors.$textDefault, 0.25),
                                    borderRadius: 999,
                                    minWidth: 18,
                                    height: 18,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingHorizontal: 4,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: '#fff',
                                      fontSize: 11,
                                      fontWeight: '700',
                                      lineHeight: 13,
                                    }}
                                  >
                                    {pendingRollback.count}
                                  </Text>
                                </View>
                                <RotateCcw size={13} color="#fff" strokeWidth={2.5} />
                              </TouchableOpacity>
                              {/* divider */}
                              <View
                                style={{
                                  width: 1,
                                  height: 14,
                                  backgroundColor: Colors.rgba(Colors.$textDefault, 0.3),
                                }}
                              />
                            </>
                          )}
                          <Check size={13} color="#fff" strokeWidth={2.5} />
                          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                            Confirm
                          </Text>
                        </View>
                      ),
                    }
                  : undefined
              }
            >
              {/* onBack/title intentionally omitted — AppStandaloneHeader's own back-button
                  slot is a fixed 64px column with the title independently centered in the
                  remaining space; children instead, same as add-card.tsx's header.
                  ModifyCollectionHeader (not a one-off chevron+Text block) so this reads as the
                  exact same header as both New/Edit Collection screens — paddingHorizontal:4
                  lands its chevron at the same 16px total inset as that component's own 16px
                  standalone default, since AppStandaloneHeader's own row already contributes 12;
                  paddingVertical:0 lets alignItems:'center' on that row center the 34px button
                  within its fixed HEADER_ROW_H instead of stacking additional height. page is
                  always 0 here (this whole block only renders for page===0, above), so onBack is
                  simply "close", not a page-back — the multi-page chevron logic this used to
                  need is gone along with the Create Collection page's own use of this header. */}
              <ModifyCollectionHeader
                title={pages?.[page].title ?? ''}
                onBack={() => setFooterFullView(false)}
                paddingHorizontal={4}
                paddingVertical={0}
              />
            </AppStandaloneHeader>
          </Animated.View>
        )}
        <FooterDetails card={card} />
      </DraggableFooter>

      {/* Off-screen pre-measurement: mirrors the wide (with-rollback) cutout content so
          wideWidthRef is populated at mount, before any rollback has actually happened — same
          trick as add-card.tsx's own off-screen measurement view, eliminating the first-appearance
          layout-pass delay that would otherwise show the pill popping to width instead of
          spring-animating to it. */}
      <View
        style={{ position: 'absolute', left: -10000, top: 0 }}
        pointerEvents="none"
        onLayout={(e) => {
          if (wideWidthRef.current === 0) {
            wideWidthRef.current = e.nativeEvent.layout.width + 32
          }
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View
              style={{
                minWidth: 18,
                height: 18,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', lineHeight: 13 }}>0</Text>
            </View>
            <RotateCcw size={13} color="#fff" strokeWidth={2.5} />
          </View>
          <View style={{ width: 1, height: 14 }} />
          <Check size={13} color="#fff" strokeWidth={2.5} />
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Confirm</Text>
        </View>
      </View>

      <Modal visible={menuOpen} onDismiss={() => setMenuOpen(false)}>
        <View style={{ width: '100%', paddingVertical: 8 }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
              paddingHorizontal: 16,
            }}
            onPress={() => {
              setMenuOpen(false)
              setPhotosModalOpen(true)
            }}
          >
            <ImageIcon size={18} color={Colors.$iconGeneral} style={{ marginRight: 8 }} />
            <Text variant="default">Upload Photos</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {collectionItemId && (
        <CollectionItemPhotosModal
          visible={photosModalOpen}
          onDismiss={() => setPhotosModalOpen(false)}
          collectionItemId={collectionItemId}
        />
      )}
    </>
  )
}

const FooterDetails = ({ card }: { card?: TCard }) => {
  const { currentPage: page, footerPages: pages } = useCardDetails()

  return (
    <Swapper
      // flex: 1 — this is the sibling meant to claim the remaining vertical space in
      // DraggableFooter's column-flex content container, below the header's own fixed-height
      // row (see that Animated.View's own comment). Swapper's own root style already forces
      // height:'100%' internally, which only resolves against a real allocated box once this
      // has flex:1 to actually grow into — without it, each page's own inner ScrollView (e.g.
      // AddToCollectionsView) never received a bounded height to fill/scroll within.
      //
      // paddingVertical only, deliberately NOT paddingHorizontal — page 0's header (Save Card
      // To) lives OUTSIDE this Swapper entirely (a sibling above it in the JSX below), so it was
      // never affected by this padding, while page 1's header+body (Create Collection, via
      // ModifyCollectionView) now render AS this Swapper's page content — an ambient horizontal
      // padding here would land only on page 1, throwing off both the header position and body
      // width relative to page 0. Each page now owns its own horizontal padding explicitly
      // instead (AddToCollectionsView's own rows; ModifyCollectionHeader/Body's own defaults).
      style={{ paddingVertical: 12, flex: 1 }}
      currentKey={page ?? 0}
      render={(key) => {
        if (!pages[key].page) return null
        const Page = pages[key].page
        return <Page />
      }}
    />
  )
}
