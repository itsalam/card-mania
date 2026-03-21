import { CollectionItem } from '@/client/collections/types'
import { ImageProxyOpts } from '@/client/image-proxy'
import { ItemKinds } from '@/constants/types'
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

export type BaseListingProps = {
  item?: { id: string }
  kind?: ItemKinds
  expanded?: boolean
  isLoading?: boolean
  className?: string
  style?: StyleProp<ViewStyle>
  cardContainerStyle?: StyleProp<ViewStyle>
  navigateOnPress?: boolean
  displayData: DisplayData | null
}

export type ItemListViewProps = ItemListingProps & {
  renderAccessories?: (
    props: BaseListingProps & {
      renderTitle?: (props: BaseListingProps) => ReactNode
    }
  ) => ReactNode
  onPress?: () => void
  navigateTo?: AppPathname
}

export type CardItemListProps = Omit<ItemListViewProps, 'item' | 'displayData'>
export type AppPathname = ExpoRouter.__routes<string>['hrefInputParams']['pathname']
