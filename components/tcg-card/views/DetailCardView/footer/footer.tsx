import { useIsWishlisted, useToggleWishlist } from '@/client/card/wishlist'
import { getDefaultPrice } from '@/components/tcg-card/helpers'
import { Button } from '@/components/ui/button'
import { Swapper } from '@/components/ui/swapper'
import { Text } from '@/components/ui/text'
import { TCard } from '@/constants/types'
import { ChevronLeft, FolderHeart, ShoppingCart, Star, X } from 'lucide-react-native'
import { useEffect, useMemo, useRef } from 'react'
import { Dimensions, View } from 'react-native'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Typography } from 'react-native-ui-lib'
import { useCardDetails } from '../provider'
import DraggableThumbContent from '../ui'
import { FooterButton } from './components/button'

const { height: H, width: W } = Dimensions.get('window')

const AButton = Animated.createAnimatedComponent(Button)

export const Footer = ({ card }: { card?: TCard }) => {
  const {
    footerFullView,
    setFooterFullView,
    currentPage: page,
    footerPages: pages,
    setPage,
  } = useCardDetails()
  const { data: wishlistSet } = useIsWishlisted('card', [card?.id].filter(Boolean) as string[])
  const toggleWishlist = useToggleWishlist()
  const grades = useMemo(
    () => (card ? ([getDefaultPrice(card).filter(Boolean)[0]] as string[]) : []),
    [card]
  )
  const prevPage = useRef<number>(page)

  useEffect(() => {
    prevPage.current = page
  }, [page])

  return (
    <DraggableThumbContent
      toggleLocked={footerFullView}
      onLockedChange={setFooterFullView}
      mainContent={
        <View>
          {!footerFullView && (
            <Animated.View
              key="footer-buttons"
              className="w-full flex flex-row gap-2 p-4"
              entering={FadeIn}
              exiting={FadeOut}
            >
              <FooterButton
                icon={FolderHeart}
                label="Collection"
                onPress={() => {
                  setFooterFullView(!footerFullView)
                }}
                stroke
              />
              <FooterButton
                disabled={!card}
                highLighted={card && wishlistSet?.has?.(card.id)}
                icon={Star}
                label="Wishlist"
                onPress={() =>
                  card &&
                  toggleWishlist.mutate({ kind: 'card', id: card.id, p_metadata: { grades } })
                }
              />
              <FooterButton
                icon={ShoppingCart}
                label="Add to Cart"
                onPress={() => {}}
                fill={false}
              />
            </Animated.View>
          )}
          {footerFullView && page !== undefined && (
            <View className="w-full flex flex-row gap-2 p-4">
              <AButton
                variant="ghost"
                size="icon"
                style={{ padding: 6, position: 'absolute', left: 12, top: 4 }}
                onPress={() => {
                  // go back to previous page if any, else close
                  if (page > 0) {
                    setPage(page - 1)
                  } else {
                    setFooterFullView(false)
                  }
                }}
                key={`footer-back-button-${page}`}
                entering={FadeIn}
                exiting={FadeOut}
              >
                {page > 0 ? <ChevronLeft /> : <X />}
              </AButton>
              <Animated.View
                key={`footer-header-${page}`}
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
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={Typography.text60M}>{pages?.[page].title}</Text>
              </Animated.View>
              {/* <FooterButton
              disabled={!card}
              highLighted={card && wishlistSet?.has?.(card.id)}
              icon={Star}
              label="Wishlist"
              onPress={() =>
                card && toggleWishlist.mutate({ kind: 'card', id: card.id, p_metadata: { grades } })
              }
            />
            <FooterButton icon={ShoppingCart} label="Add to Cart" onPress={() => {}} fill={false} /> */}
            </View>
          )}
        </View>
      }
    >
      <FooterDetails card={card} />
    </DraggableThumbContent>
  )
}

const FooterDetails = ({ card }: { card?: TCard }) => {
  const { footerFullView, setFooterFullView } = useCardDetails()
  const { height } = useReanimatedKeyboardAnimation() // <- shared values
  const insets = useSafeAreaInsets()

  const opacity = useSharedValue(footerFullView ? 1 : 0)
  useEffect(() => {
    opacity.value = withTiming(footerFullView ? 1 : 0, { duration: 250 })
  }, [footerFullView])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    paddingBottom: Math.max(insets.bottom, -height.value + 12),
  }))

  const { currentPage: page, footerPages: pages } = useCardDetails()

  return (
    <Animated.View
      style={[
        {
          height: H * 0.8,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: Colors.$backgroundPrimary,
        },
        animatedStyle,
      ]}
    >
      <Swapper
        style={{
          width: '100%',
          grow: 1,
        }}
        currentKey={page ?? 0}
        render={(key) => {
          if (!pages[key].page) return null
          const Page = pages[key].page
          return <Page />
        }}
      />
    </Animated.View>
  )
}
