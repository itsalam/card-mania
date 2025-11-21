import { TCard } from '@/constants/types'
import { useTouchRecentView } from '@/lib/store/functions/hooks'
import { View } from 'react-native'

type GetDefaultPriceReturn = [string, number] | [null]
export const getDefaultPrice = (card: TCard): GetDefaultPriceReturn => {
  const gradePrices = card.grades_prices as Record<string, number>
  const key = 'ungraded' in gradePrices ? 'ungraded' : Object.keys(gradePrices)[0]
  const value = Number(gradePrices[key])
  return key ? [key, value] : [null]
}

import { useStores } from '@/lib/store/provider'
import { useFocusEffect } from '@react-navigation/native'; // or from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { router, usePathname } from 'expo-router'
import { useCallback, useRef } from 'react'

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

export function useNavigateToDetailCard(card: TCard, cb?: () => void) {
  const cardElement = useRef<View>(null)
  const { setPrefetchData } = useStores().cardStore.getInitialState()
  const mutation = useTouchRecentView()
  const pathname = usePathname()

  const handlePress = () => {
    const positionPromise = measureInWindowAsync(cardElement as unknown as React.RefObject<View>)
    setPrefetchData(card.id, card)
    positionPromise.then((position) => {

      mutation.mutate({
        type: 'card',
        id: card.id,
        source: 'app',
      })
      router.push({
        pathname: `/cards/[card]`,
        params: {
          from: JSON.stringify(position),
          card: card.id,
          returnTo: pathname ?? '/',
        },
      })
    })
  }

  return { cardElement, handlePress }
}
