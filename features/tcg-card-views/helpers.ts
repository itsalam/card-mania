import { CollectionItem } from '@/client/collections/types'
import { CollectionItemImage, PrimaryPhotoRow } from '@/client/collections/photos'
import { ImageProxyOpts } from '@/client/image-proxy'
import { TCard } from '@/constants/types'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { DisplayData } from './types'

type Metadata = {
  price_key: string
}

/**
 * Builds the same `-thumb` cacheKey `useImageProxy`'s 'tiny' variant callers use for a
 * given image (card-image.tsx's list-tile thumbnail, DetailCardView's hero placeholder,
 * etc.) — `queryHash` (query-hash-addressed vendor image) beats `imageId` (a
 * user-uploaded/content-addressed photo) beats `cardId` (vendor fallback), exactly
 * mirroring how `useImageProxy` itself picks which lookup mode to use. Sharing this one
 * builder keeps every caller's cacheKey identical for the same photo — if two callers'
 * keys drift, expo-image treats them as different images and neither can reuse the
 * other's already-decoded disk/memory cache entry, which previously left the detail
 * view's placeholder re-fetching a bitmap the list tile had just rendered.
 */
export const buildThumbCacheKey = (
  args: Pick<ImageProxyOpts, 'queryHash' | 'imageId' | 'cardId'>
) => `${args.queryHash || args.imageId || args.cardId}-thumb`

/**
 * Reorders an item's photos so whichever one is primary (already on display before the
 * carousel mounts) leads — swiping right then reveals the rest in their existing
 * (position/created_at) order, rather than jumping straight to wherever the primary
 * happened to sort.
 */
export const orderCarouselPhotos = (photos: CollectionItemImage[]): CollectionItemImage[] => {
  if (photos.length === 0) return photos
  const primaryIndex = photos.findIndex((p) => p.is_primary)
  if (primaryIndex <= 0) return photos
  return [photos[primaryIndex], ...photos.slice(0, primaryIndex), ...photos.slice(primaryIndex + 1)]
}

export const getDisplayPrice = (args: {
  collectionItem?: Partial<CollectionItemQueryView>
  card: TCard
  metadata?: Metadata
}) => {
  const { collectionItem, card, metadata } = args
  let price = collectionItem?.collection_item_value
  if (price) return price

  const priceKey = metadata?.price_key.replace(/(\d+)(?:\.(\d))?/g, (_match, intPart, fracPart) =>
    !fracPart || fracPart === '0' ? intPart : `${intPart}_${fracPart}`
  )

  const gradePrice = card.grades_prices as Record<string, number>

  if (priceKey && gradePrice && priceKey in gradePrice) return gradePrice[priceKey]
  return card.latest_price ?? undefined
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
  primaryPhoto,
  primaryPhotoLoading,
  isLoading,
  metadata,
}: {
  card?: TCard
  collectionItem?: CollectionItem
  /**
   * The item's primary user-uploaded photo, if any — see `usePrimaryPhoto` in
   * `client/collections/photos.ts`. Only needed as a fallback for callers whose
   * `collectionItem` wasn't fetched through a query that embeds `primary_image_cache_id`
   * (`collection_item_query` / `viewSingleCollectionItem`) — see below. Narrowed to just
   * the field this actually reads so a preloaded id (e.g. passed as a navigation param
   * ahead of the real fetch resolving) can stand in for the full row.
   */
  primaryPhoto?: Pick<PrimaryPhotoRow, 'image_cache_id'> | null
  /**
   * Pass `usePrimaryPhoto`'s own `isLoading` here when the caller actually runs that
   * query (fallback path only — see `primaryPhoto`). While true, `imageProxyArgs`
   * resolves to no source at all (rather than the vendor card image) — callers that
   * don't fetch a primary photo at all should leave this unset, which preserves showing
   * the vendor image immediately as before.
   *
   * Without this, a caller that DOES fetch a primary photo would show the vendor image
   * first and then swap to the user's real photo once the fetch resolves, since
   * `primaryPhoto` is indistinguishable from "not applicable" while still loading.
   */
  primaryPhotoLoading?: boolean
  metadata?: Metadata
  isLoading?: boolean
}) => {
  const isIncomplete = Boolean(card) && isLoading
  // CollectionItem (table row) vs CollectionItemQueryView (RPC row) diverge on a few
  // nullability details (e.g. collection_ref); getDisplayPrice only reads
  // collection_item_value, which both shapes carry identically.
  const displayPriceFix =
    card === undefined
      ? null
      : getDisplayPrice({
          card,
          collectionItem: collectionItem as Partial<CollectionItemQueryView> | undefined,
          metadata,
        })

  // `collection_item_query` and `viewSingleCollectionItem` embed the item's primary photo
  // directly on the row now, so `primary_image_cache_id` is always present (as `string |
  // null`, never `undefined`) on a `collectionItem` fetched through either — using it here
  // skips the separate `usePrimaryPhoto(collectionItem.id)` round trip (and the whole
  // "vendor image renders first, then swaps once that second fetch resolves" window that
  // caused several bugs earlier). Callers whose `collectionItem` predates that embed (e.g.
  // still going through `collection_items_by_ref`, or no `collectionItem` at all) leave
  // this `undefined`, so they fall through to the explicit `primaryPhoto`/
  // `primaryPhotoLoading` params exactly as before.
  const embeddedPrimaryImageId = collectionItem?.primary_image_cache_id
  const effectivePrimaryPhoto: Pick<PrimaryPhotoRow, 'image_cache_id'> | null | undefined =
    embeddedPrimaryImageId !== undefined
      ? embeddedPrimaryImageId
        ? { image_cache_id: embeddedPrimaryImageId }
        : null
      : primaryPhoto
  const effectivePrimaryPhotoLoading =
    embeddedPrimaryImageId !== undefined ? false : primaryPhotoLoading

  // id/imageId/title can be undefined here (card/collectionItem both unset) — pre-existing
  // looseness in DisplayData's required fields, unrelated to this function; cast rather
  // than widen the shared type.
  const displayData = (
    !Boolean(card) && isIncomplete
      ? null
      : {
          id: collectionItem?.id ?? card?.id,
          title: card?.name,
          subHeading: card?.set_name,
          imageProxyArgs: effectivePrimaryPhoto
            ? ({
                variant: 'tiny',
                shape: 'card',
                imageId: effectivePrimaryPhoto.image_cache_id,
              } as ImageProxyOpts)
            : effectivePrimaryPhotoLoading
              ? // Still resolving whether this item has a user-uploaded primary photo —
                // no source at all (CardImage/useImageProxy stay disabled, showing the
                // neutral placeholder) rather than committing to the vendor image and
                // then swapping to the real photo once the fetch lands.
                ({ variant: 'tiny', shape: 'card' } as ImageProxyOpts)
              : ({
                  variant: 'tiny',
                  shape: 'card',
                  cardId: card?.id ?? collectionItem?.ref_id,
                  imageType: 'front',
                  queryHash: card?.image?.query_hash ?? undefined,
                  directUrl: card?.image?.url ?? undefined,
                } as ImageProxyOpts),
          // Always the card's own aspect ratio, never the raw uploaded photo's — the photo
          // is confined to the card's slot ratio and cropped to fit (see CardImage), not the
          // other way around, so list items keep a uniform card shape regardless of what
          // aspect ratio the user's photo was taken in.
          aspectRatio: card?.image?.aspectRatio ?? undefined,
          displayPrice: displayPriceFix ?? null,
          metadata: metadata?.price_key,
          quantity: collectionItem?.quantity,
        }
  ) as DisplayData | null

  return displayData
}
