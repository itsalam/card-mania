import { CollectionItem } from '@/client/collections/types'
import { ImageProxyOpts } from '@/client/image-proxy'
import { ItemKinds, TCard } from '@/constants/types'
import type { ExpoRouter } from 'expo-router/build/types'
import { ReactNode } from 'react'
import { StyleProp, ViewStyle } from 'react-native'

export type ViewTypes = 'group' | 'single' | 'square' | 'detail'
export type DisplayData = {
  id: string
  imageId: string
  title: string
  subHeading?: string
  metadata?: string
  displayPrice?: number | null
  imageProxyArgs: ImageProxyOpts
  onPress?: () => void
  quantity?: number
  /** W/H pixel aspect ratio resolved from image-proxy; undefined until the image loads. */
  aspectRatio?: number
}
export type ItemListingProps = BaseListingProps & {
  expanded?: boolean
  vertical?: boolean
  collectionItem?: CollectionItem
}

export type GalleryListingProps = BaseListingProps & {
  displayDataArr: DisplayData[] | null
  vertical?: boolean
  renderItemAccessories?: (isCurrent: boolean) => (props: BaseListingProps) => ReactNode
}

export type BaseListingProps<T = TCard> = {
  itemId: string
  item: T
  kind?: ItemKinds
  expanded?: boolean
  isLoading?: boolean
  className?: string
  style?: StyleProp<ViewStyle>
  cardContainerStyle?: StyleProp<ViewStyle>
  navigateOnPress?: boolean
  displayData: DisplayData | null
  /** Position within the list this item was rendered from, when the caller's list happens to
   *  know it (e.g. SearchScreen's FlatList) — undefined for views with no ordered list context.
   *  Purely informational for consumers like add-card.tsx that need to single out "the first
   *  result" for a one-time coach-mark; not used by the row rendering itself. */
  index?: number
}

export type ItemListViewProps = ItemListingProps & {
  gain?: number
  renderAccessories?: (
    props: BaseListingProps & {
      renderTitle?: (props: BaseListingProps) => ReactNode
    }
  ) => ReactNode
  onPress?: () => void
  navigateTo?: AppPathname
  /** Custom node rendered in the bottom-right corner of the card image.
   *  Pass `null` to suppress the default Maximize icon. */
  imageAccessory?: ReactNode
  hide?: Record<'title' | 'subtitle' | 'grade' | 'price', boolean>
}

export type CardItemListProps = Omit<ItemListViewProps, 'item' | 'displayData'>
export type AppPathname = ExpoRouter.__routes<string>['hrefInputParams']['pathname']
