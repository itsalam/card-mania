import { useViewCollectionItemsForCard } from '@/client/collections/query'
import { CollectionLike } from '@/client/collections/types'
import { CollectionItemEntry } from '@/components/collections/items/editable-entry-item'
import { Spinner } from '@/components/ui/spinner'
import { CollectionItemRow } from '@/lib/store/functions/types'
import { Plus } from 'lucide-react-native'
import React, { useState } from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useCardDetails } from '../../provider'
import { FooterButton } from '../components/button'
// import { Label } from '@react-navigation/elements'

export const CollectionCardEntries = ({
  collection,
  isShown,
}: {
  collection: CollectionLike
  isShown: boolean
}) => {
  //TODO: fetch collection entries for this collection and card
  const { card } = useCardDetails()

  const {
    data: loadedEntries,
    error,
    isLoading,
  } = useViewCollectionItemsForCard(collection.id!, card?.id!, isShown)

  const [newEntries, setNewEntries] = useState<Array<Partial<CollectionItemRow>>>(
    loadedEntries.length ? loadedEntries : [{}]
  )

  return (
    <View
      style={{
        flexDirection: 'column',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderColor: Colors.$outlineDefault,
        borderWidth: 2,
        backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.5),
        gap: 8,
      }}
    >
      {isLoading || card === null ? (
        <Spinner />
      ) : (
        newEntries.map((entry, index) => {
          return (
            <CollectionItemEntry
              card={card}
              key={`${index}-new`}
              collectionItem={entry}
              collection={collection}
              onDelete={() => setNewEntries((prev) => [...prev.filter((_, i) => i !== index)])}
            />
          )
        })
      )}

      <View
        style={{
          paddingVertical: 4,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        <FooterButton
          highLighted
          style={{ flexGrow: 1, flex: 1, width: '100%' }}
          onPress={() => {
            setNewEntries((prev) => [...prev, {}])
          }}
          label="Add"
          iconSource={(style) => <Plus style={style} color={Colors.$iconDefaultLight} />}
        />
      </View>
    </View>
  )
}
