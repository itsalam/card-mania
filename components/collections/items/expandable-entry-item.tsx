import { useToggleWishlist } from '@/client/card/wishlist'

import { CollectionLike } from '@/client/collections/types'
import { CollectionCardItemEntries } from '@/components/tcg-card/views/DetailCardView/footer/add-to-collections/components'
import { TCard } from '@/constants/types'
import { Blocks, Heart } from 'lucide-react-native'
import React, { useState } from 'react'
import { ExpandableSection, RadioButton } from 'react-native-ui-lib'
import { CollectionListView } from '../list-item'

export const ExpandableCollectionEntryListItem = ({
  collection,
  card,
}: {
  collection: CollectionLike
  card?: TCard
}) => {
  const [expanded, setExpanded] = useState(false)
  const isWishlist = collection?.id === 'wishlist'
  const toggleWishlist = useToggleWishlist('card')

  const ItemView = () => (
    <CollectionListView
      onPress={
        isWishlist
          ? () => card && toggleWishlist.mutate({ kind: 'card', id: card.id })
          : () => setExpanded(!expanded)
      }
      collection={collection}
      icon={isWishlist ? Heart : Blocks}
      rightElement={<RadioButton selected={collection.has_item} />}
    />
  )

  if (isWishlist) {
    return <ItemView />
  }

  return (
    <ExpandableSection expanded={expanded} sectionHeader={<ItemView />}>
      {card && <CollectionCardItemEntries collection={collection} isShown={expanded} card={card} />}
    </ExpandableSection>
  )
}
