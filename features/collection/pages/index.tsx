import React from 'react'

import { CollectionsPageLayout } from '../components/CollectionPageLayout'
import { CollectionsViewProvider } from '../provider'

export default function CollectionScreen() {
  return (
    <CollectionsViewProvider>
      <CollectionsPageLayout />
    </CollectionsViewProvider>
  )
}
