import { useIsWishlisted, useToggleWishlist } from '@/client/card/wishlist'
import { CollectionItemPhotosModal } from '@/components/collections/items/photos-modal'
import DraggableFooter from '@/components/DraggableFooter'
import { AppStandaloneHeader } from '@/components/ui/headers'
import { Modal } from '@/components/ui/modal'
import { Swapper } from '@/components/ui/swapper'
import { Text } from '@/components/ui/text'
import { TCard } from '@/constants/types'
import { useCartCount, useOpenCart } from '@/features/cart/hooks'
import {
  Check,
  EllipsisVertical,
  FolderHeart,
  Image as ImageIcon,
  RotateCcw,
  ShoppingCart,
  Star,
} from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { Dimensions, TouchableOpacity, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { useCardDetails } from '../provider'
import { FooterButton } from './components/button'

const { height: H } = Dimensions.get('window')

export const Footer = ({
  card,
  onLockedChange,
  isOwnCollectionItem,
  collectionItemId,
}: {
  card?: TCard
  onLockedChange?: (v: boolean) => void
  /** True only when the signed-in user owns this collection item — swaps Cart for Menu. */
  isOwnCollectionItem?: boolean
  collectionItemId?: string
}) => {
  const {
    footerFullView,
    setFooterFullView,
    currentPage: page,
    footerPages: pages,
    setPage,
    pendingRollback,
  } = useCardDetails()
  const [rollingBack, setRollingBack] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [photosModalOpen, setPhotosModalOpen] = useState(false)
  const { data: wishlistSet } = useIsWishlisted('card', [card?.id].filter(Boolean) as string[])
  const toggleWishlist = useToggleWishlist('card')
  const prevPage = useRef<number>(page)
  const cartCount = useCartCount()
  const openCart = useOpenCart()

  useEffect(() => {
    prevPage.current = page
  }, [page])

  useEffect(() => {
    const cutoutVisible = page === 0
  }, [page, pendingRollback])

  return (
    <>
      <DraggableFooter
        toggleLocked={footerFullView}
        onLockedChange={(l) => {
          setFooterFullView(l)
          onLockedChange?.(l)
        }}
        mainContent={
          <>
            {!footerFullView ? (
              <Animated.View
                key="footer-buttons"
                style={{ paddingHorizontal: 8 }}
                className="flex flex-row gap-2 py-0"
                entering={FadeIn}
                exiting={FadeOut}
              >
                <FooterButton
                  icon={FolderHeart}
                  label="Collection"
                  onPress={() => {
                    setFooterFullView(!footerFullView)
                  }}
                />
                <FooterButton
                  disabled={!card}
                  highLighted={card && wishlistSet?.has?.(card.id)}
                  icon={Star}
                  label="Wishlist"
                  onPress={() => card && toggleWishlist.mutate({ kind: 'card', id: card.id })}
                />

                {isOwnCollectionItem && collectionItemId ? (
                  <FooterButton
                    icon={EllipsisVertical}
                    accessibilityLabel="Menu"
                    onPress={() => setMenuOpen(true)}
                    style={{ flex: 0 }}
                  />
                ) : (
                  <FooterButton
                    icon={ShoppingCart}
                    label="Cart"
                    onPress={openCart}
                    highLighted={cartCount > 0}
                    fill={false}
                    style={{ flex: 1 }}
                  >
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        // top: 12,
                        // transform: [{ translateY: '-50%' }],
                        right: 10,
                        backgroundColor: Colors.$outlinePrimary,
                        borderRadius: 99,
                        minWidth: 20,
                        height: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                      }}
                    >
                      <Text
                        style={{ color: 'white', fontSize: 10, fontWeight: '700', lineHeight: 12 }}
                      >
                        {cartCount > 9 ? '9+' : cartCount}
                      </Text>
                    </View>
                  </FooterButton>
                )}
              </Animated.View>
            ) : page !== undefined ? (
              <Animated.View
                key={`footer-header-${page}`}
                className="w-full flex flex-row flex-1"
                entering={
                  page === undefined
                    ? FadeIn
                    : page > (prevPage.current ?? -Infinity)
                      ? FadeInRight.delay(75)
                      : FadeInLeft.delay(75)
                }
                exiting={
                  page === undefined
                    ? FadeOut
                    : page > (prevPage.current ?? -Infinity)
                      ? FadeOutLeft
                      : FadeOutRight
                }
              >
                <AppStandaloneHeader
                  onBack={() => {
                    // go back to previous page if any, else close
                    if (page > 0) {
                      setPage(page - 1)
                    } else {
                      setFooterFullView(false)
                    }
                  }}
                  title={pages?.[page].title}
                  style={{ flex: 1 }}
                  cutout={
                    page === 0
                      ? {
                          onPress: () => setFooterFullView(false),
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
                />
              </Animated.View>
            ) : null}
          </>
        }
        style={{
          height: H * 0.8,
        }}
      >
        <FooterDetails card={card} />
      </DraggableFooter>

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
      style={{ padding: 12 }}
      currentKey={page ?? 0}
      render={(key) => {
        if (!pages[key].page) return null
        const Page = pages[key].page
        return <Page />
      }}
    />
  )
}
