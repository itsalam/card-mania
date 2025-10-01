import { TCard } from '@/constants/types'

type GetDefaultPriceReturn = [string, number] | [null]
export const getDefaultPrice = (card: TCard): GetDefaultPriceReturn => {
  const gradePrices = card.grades_prices as Record<string, number>
  const key = 'ungraded' in gradePrices ? 'ungraded' : Object.keys(gradePrices)[0]
  const value = Number(gradePrices[key])
  return key ? [key, value] : [null]
}
