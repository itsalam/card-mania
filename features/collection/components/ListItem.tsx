import { HStack } from '@/components/ui/hstack'
import { VStack } from '@/components/ui/vstack'
import React, { ComponentProps } from 'react'
import { CollectionsPreviewIcon } from './PreviewIcon'

export { CollectionsPreviewIcon as Icon } from './PreviewIcon'

export function CollectionsListItem({
  children,
  isOpen,
  cardWidth = 72,
  ...props
}: ComponentProps<typeof VStack> & { isOpen?: boolean; cardWidth?: number }) {
  return (
    <HStack style={{ display: 'flex' }} className="gap-2" {...props}>
      <CollectionsPreviewIcon width={isOpen ? cardWidth * 1.35 : cardWidth} />
      {children}
    </HStack>
  )
}
