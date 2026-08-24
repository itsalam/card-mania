import { Graders } from '@/client/card/grading'
import { ItemKinds, TCard } from '@/constants/types'
import { AppPathname } from '@/features/tcg-card-views/types'
import { useTouchRecentView } from '@/lib/store/functions/hooks'
import { useStores } from '@/lib/store/provider'
import { useFocusEffect } from '@react-navigation/native' // or from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { router, usePathname, type Href } from 'expo-router'
import { useCallback, useRef } from 'react'
import { View } from 'react-native'

export type GetDefaultPriceReturn = number | null

export const getGradedPrice = (opts: {
  card: TCard
  graders: Graders[]
  gradeId?: string
}): GetDefaultPriceReturn => {
  const { card, graders, gradeId } = opts
  const grader = graders.find((gd) => gd.grades.some((grade) => grade.id === gradeId))
  const currentGrade = grader?.grades.find((grade) => grade.id === gradeId)
  const gradePrices = (card.grades_prices ?? {}) as Record<string, number>
  let key = 'ungraded'
  if (grader && currentGrade) {
    key = `${grader.slug}${currentGrade.grade_value}`.replace('.', '_')
  }
  const value = Number(gradePrices[key])
  if (value) return value
  return null
}

export function useInvalidateOnFocus(queryKey: readonly unknown[]) {
  const qc = useQueryClient()
  useFocusEffect(
    useCallback(() => {
      // Mark it stale → active observers refetch in background
      qc.invalidateQueries({ queryKey, exact: true, type: 'active' })

      // If you want a guaranteed immediate refetch:
      // qc.refetchQueries({ queryKey, exact: true, type: 'active' });

      // no cleanup needed
      return () => {}
    }, [qc, queryKey])
  )
}

export function measureInWindowAsync(
  ref: React.RefObject<View>
): Promise<{ x: number; y: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const node = ref.current as any
    if (!node?.measureInWindow) {
      return reject(new Error('measureInWindow missing'))
    }
    node.measureInWindow((x: number, y: number, width: number, height: number) => {
      resolve({ x, y, width, height })
    })
  })
}

// Module-level (not per-hook-instance) since navigation is a single global action —
// this is what stops a quick double-tap across two DIFFERENT list items from pushing
// two overlapping detail views, not just repeat taps on the same item.
let navigationLocked = false
const NAVIGATION_LOCK_MS = 600

export function useNavigateToItem<T = TCard>({
  kind,
  item,
  path = '/cards/[card]',
  paramName = 'card',
  params,
}: {
  kind: ItemKinds
  item: T
  path?: AppPathname
  paramName?: string
  params?: Record<string, string>
}) {
  const itemElement = useRef<View>(null)
  const { setPrefetchData } = useStores().cardStore.getInitialState()
  const mutation = useTouchRecentView()
  const pathname = usePathname()

  const handlePress = () => {
    if (!item) return
    if (navigationLocked) return
    navigationLocked = true
    // For collection-item-based navigations (ItemListView passes the collectionItem as
    // `item` so item.id lands correctly in the [shop-item] route param), item.id is the
    // COLLECTION ITEM's id, not the card's — params.cardId (set by ItemListView in that
    // case) carries the real card id. Recent-views/prefetch must key on the card id, or
    // RecentlyViewedCard's useCardQuery(item.item_id) looks up a card that doesn't exist.
    const cardId = params?.cardId ?? item.id
    const positionPromise = measureInWindowAsync(itemElement as unknown as React.RefObject<View>)
    setPrefetchData(cardId, item)
    positionPromise
      .then((position) => {
        mutation.mutate({
          type: kind,
          id: cardId,
          source: 'app',
        })
        router.push({
          pathname: path,
          params: {
            from: JSON.stringify(position),
            [paramName]: item.id,
            kind: kind,
            returnTo: pathname ?? '/',
            ...params,
          },
        } as Href)
      })
      .finally(() => {
        setTimeout(() => {
          navigationLocked = false
        }, NAVIGATION_LOCK_MS)
      })
  }

  return { cardElement: itemElement, handlePress }
}
