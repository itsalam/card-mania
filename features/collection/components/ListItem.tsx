import React, { ComponentProps } from 'react'
import { View } from 'react-native'
import { CollectionsPreviewIcon } from './PreviewIcon'

export { CollectionsPreviewIcon as Icon } from './PreviewIcon'

export function CollectionsListItem({
  children,
  isOpen,
  cardWidth = 72,
  ...props
}: ComponentProps<typeof View> & { isOpen?: boolean; cardWidth?: number }) {
  return (
    <View style={{ display: 'flex', flexDirection: 'row' }} className="gap-2" {...props}>
      <CollectionsPreviewIcon width={isOpen ? cardWidth * 1.35 : cardWidth} />
      {children}
    </View>
  )
}
