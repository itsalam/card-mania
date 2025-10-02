import { TCard } from '@/constants/types'
import { measureInWindowAsync } from '@/features/overlay/utils'
import { useTouchRecentView } from '@/store/functions/hooks'

type GetDefaultPriceReturn = [string, number] | [null]
export const getDefaultPrice = (card: TCard): GetDefaultPriceReturn => {
  const gradePrices = card.grades_prices as Record<string, number>
  const key = 'ungraded' in gradePrices ? 'ungraded' : Object.keys(gradePrices)[0]
  const value = Number(gradePrices[key])
  return key ? [key, value] : [null]
}

import { useStores } from '@/store/provider'
import { useFocusEffect } from '@react-navigation/native' // or from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useCallback, useRef } from 'react'
import { Card } from '../ui/card'

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

export function useNavigateToDetailCard(card: TCard, cb: () => void) {
  const cardElement = useRef<typeof Card>(null)
  const { setPrefetchData } = useStores().cardStore.getInitialState()
  const mutation = useTouchRecentView()

  const handlePress = () => {
    const positionPromise = measureInWindowAsync(cardElement as unknown as React.RefObject<View>)
    setPrefetchData(card.id, card)
    positionPromise.then((position) => {
      mutation.mutate(
        {
          type: 'card',
          id: card.id,
          source: 'app',
        },
        {
          onSuccess: (data) => {
            console.log('Mutation success:', data)
            cb()
          },
          onError: (error) => {
            console.error('Mutation error:', error)
          },
        }
      )
      router.navigate({
        pathname: `/cards/[card]`,
        params: { from: JSON.stringify(position), card: card.id },
      })
    })
  }

  return { cardElement, handlePress }
}
