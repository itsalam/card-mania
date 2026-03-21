import { useIsWishlisted, useToggleWishlist } from '@/client/card/wishlist'
import DraggableFooter from '@/components/DraggableFooter'
import { AppStandaloneHeader } from '@/components/ui/headers'
import { Swapper } from '@/components/ui/swapper'
import { Text } from '@/components/ui/text'
import { TCard } from '@/constants/types'
import { useCartCount, useOpenCart } from '@/features/cart/hooks'
import { FolderHeart, ShoppingCart, Star } from 'lucide-react-native'
import { useEffect, useRef } from 'react'
import { Dimensions, View } from 'react-native'
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

export const Footer = ({ card }: { card?: TCard }) => {
  const {
    footerFullView,
    setFooterFullView,
    currentPage: page,
    footerPages: pages,
    setPage,
  } = useCardDetails()
  const { data: wishlistSet } = useIsWishlisted('card', [card?.id].filter(Boolean) as string[])
  const toggleWishlist = useToggleWishlist('card')
  const prevPage = useRef<number>(page)
  const cartCount = useCartCount()
  const openCart = useOpenCart()

  useEffect(() => {
    prevPage.current = page
  }, [page])

  return (
    <DraggableFooter
      toggleLocked={footerFullView}
      onLockedChange={setFooterFullView}
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
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: '700', lineHeight: 12 }}>
                    {cartCount > 9 ? '9+' : cartCount}
                  </Text>
                </View>
              </FooterButton>
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
