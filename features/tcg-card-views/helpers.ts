import { CollectionItem } from '@/client/collections/types'
import { ImageProxyOpts } from '@/client/image-proxy'
import { TCard } from '@/constants/types'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { DisplayData } from './types'

type Metadata = {
  price_key: string
}

export const getPriceFix = (args: {
  collectionItem?: Partial<CollectionItemQueryView>
  card: TCard
  metadata?: Metadata
}) => {
  const { collectionItem, card, metadata } = args
  let price = collectionItem?.collection_item_value
  if (price) return price

  if (!metadata) {
    return card.latest_price
  }

  if (!metadata.price_key) return undefined

  const priceKey = metadata.price_key.replace(/(\d+)(?:\.(\d))?/g, (_match, intPart, fracPart) =>
    !fracPart || fracPart === '0' ? intPart : `${intPart}_${fracPart}`
  )

  const gradePrice = card.grades_prices as Record<string, number>

  if (priceKey in gradePrice) return gradePrice[priceKey]
  return undefined
}

export const sortCollectionItem = (a: Partial<CollectionItem>, b: Partial<CollectionItem>) => {
  //@ts-ignore
  const aHasCompany = Boolean(a.grading_company_id || a.grading_company)
  //@ts-ignore
  const bHasCompany = Boolean(b.grading_company_id || b.grading_company)
  if (aHasCompany !== bHasCompany) return aHasCompany ? 1 : -1

  const aCompany = (a.grading_company ?? '').toLowerCase()
  const bCompany = (b.grading_company ?? '').toLowerCase()
  if (aCompany !== bCompany) return aCompany.localeCompare(bCompany)

  //@ts-ignore
  const aGradeValue = a.grade_condition?.grade_value ?? Number.NEGATIVE_INFINITY
  //@ts-ignore
  const bGradeValue = b.grade_condition?.grade_value ?? Number.NEGATIVE_INFINITY
  if (aGradeValue !== bGradeValue) return aGradeValue - bGradeValue

  //@ts-ignore
  const aVariants = a.variants ?? []
  //@ts-ignore
  const bVariants = b.variants ?? []
  const aVariantsEmpty = aVariants.length === 0
  const bVariantsEmpty = bVariants.length === 0
  if (aVariantsEmpty !== bVariantsEmpty) return aVariantsEmpty ? -1 : 1
  const aVariantsKey = aVariants.join(',').toLowerCase()
  const bVariantsKey = bVariants.join(',').toLowerCase()
  if (aVariantsKey !== bVariantsKey) {
    return aVariantsKey.localeCompare(bVariantsKey)
  }

  //@ts-ignore
  const aCreatedBy = a.updated_at ?? ''
  //@ts-ignore
  const bCreatedBy = b.updated_at ?? ''
  return aCreatedBy.localeCompare(bCreatedBy)
}

export const getCardDisplayData = ({
  card,
  collectionItem,
  isLoading,
  metadata,
}: {
  card?: TCard
  collectionItem?: CollectionItem
  metadata?: Metadata
  isLoading?: boolean
}) => {
  const isIncomplete = Boolean(card) && isLoading
  const displayPriceFix =
    card === undefined ? null : getPriceFix({ card, collectionItem, metadata })
  const displayData: DisplayData | null =
    !Boolean(card) && isIncomplete
      ? null
      : {
          id: collectionItem?.id ?? card?.id,
          title: card?.name,
          subHeading: card?.set_name,
          imageProxyArgs: {
            variant: 'tiny',
            shape: 'card',
            cardId: card?.id ?? collectionItem?.ref_id,
            imageType: 'front',
            queryHash: card?.image?.query_hash ?? undefined,
          } as ImageProxyOpts,
          displayPrice: displayPriceFix ?? null,
          metadata: metadata?.price_key,
          quantity: collectionItem?.quantity,
        }

  return displayData
}
