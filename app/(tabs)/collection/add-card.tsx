import AddCardToCollection from '@/features/collection/pages/add-card'
import { useLocalSearchParams } from 'expo-router'
import React, { useEffect } from 'react'
import { Text, View } from 'react-native'

type AddCardParams = {
  collectionId?: string
}

type AddCardScreenProps = {
  onMissingCollectionId?: (params: AddCardParams) => void
}

export default function AddCardScreen(props: AddCardScreenProps) {
  const { collectionId } = useLocalSearchParams<AddCardParams>()

  useEffect(() => {
    if (!collectionId) {
      props.onMissingCollectionId?.({})
    }
  }, [collectionId, props.onMissingCollectionId])

  if (!collectionId) {
    // Simple fallback UI; caller can override behavior via onMissingCollectionId
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>No collection selected.</Text>
      </View>
    )
  }

  return <AddCardToCollection collectionId={collectionId} />
}
