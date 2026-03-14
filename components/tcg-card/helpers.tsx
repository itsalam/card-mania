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

type GetDefaultPriceReturn = [string, number] | [null]

export const getGradedPrice = (opts: {
  card: TCard
  graders: Graders[]
  gradeId: string
}): GetDefaultPriceReturn => {
  const { card, graders, gradeId } = opts
  const grader = graders.find((gd) => gd.grades.some((grade) => grade.id === gradeId))
  const currentGrade = grader?.grades.find((grade) => grade.id === gradeId)
  const gradePrices = (card.grades_prices ?? {}) as Record<string, number>
  if (grader && currentGrade) {
    let key = `${grader.slug}${currentGrade.grade_value}`.replace('.', '_')
    const value = Number(gradePrices[key])
    if (value) return [key, value]
  }
  return [null]
}

export const getDefaultPrice = (card?: TCard): GetDefaultPriceReturn => {
  const gradePrices = (card?.grades_prices ?? {}) as Record<string, number>
  const keys = Object.keys(gradePrices)
  if (!keys.length) return [null]

  return [null]
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

export function useNavigateToItem({
  kind,
  item,
  path = '/cards/[card]',
  paramName = 'card',
  params,
}: {
  kind: ItemKinds
  item?: { id: string }
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
    const positionPromise = measureInWindowAsync(itemElement as unknown as React.RefObject<View>)
    setPrefetchData(item.id, item)
    positionPromise.then((position) => {
      mutation.mutate({
        type: kind,
        id: item.id,
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
  }

  return { cardElement: itemElement, handlePress }
}
