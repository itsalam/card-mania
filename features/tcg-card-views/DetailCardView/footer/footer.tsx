import { useIsWishlisted, useToggleWishlist } from '@/client/card/wishlist'
import { getDefaultPrice } from '@/components/tcg-card/helpers'
import { AppStandaloneHeader } from '@/components/ui/headers'
import { Swapper } from '@/components/ui/swapper'
import { TCard } from '@/constants/types'
import { FolderHeart, ShoppingCart, Star } from 'lucide-react-native'
import { useEffect, useMemo, useRef } from 'react'
import { Dimensions } from 'react-native'
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
} from 'react-native-reanimated'
import { useCardDetails } from '../provider'
import DraggableThumbContent from '../ui'
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
        <>
          {!footerFullView ? (
            <Animated.View
              key="footer-buttons"
              className="w-full flex flex-row gap-2 p-4 flex-1"
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
    </DraggableThumbContent>
  )
}

const FooterDetails = ({ card }: { card?: TCard }) => {
  const { currentPage: page, footerPages: pages } = useCardDetails()

  return (
    <Swapper
      currentKey={page ?? 0}
      render={(key) => {
        if (!pages[key].page) return null
        const Page = pages[key].page
        return <Page />
      }}
    />
  )
}
