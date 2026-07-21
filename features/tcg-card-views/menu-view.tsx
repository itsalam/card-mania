import { useCardQuery } from '@/client/card'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { Footer } from './DetailCardView/footer/footer'
import { AddToCollectionsView } from './DetailCardView/pages/add-to-collections'
import { CreateCollectionView } from './DetailCardView/pages/create-collection'
import { CardDetailsProvider } from './DetailCardView/provider'

export default function CardMenuModalView({ cardId }: { cardId: string }) {
  const { data: cardData } = useCardQuery(cardId)
  const router = useRouter()
  const footerPages = useMemo(
    () => [
      { title: 'Add to Collection', page: AddToCollectionsView },
      { title: 'Create Collection', page: CreateCollectionView },
    ],
    []
  )

  return (
    <CardDetailsProvider card={cardData} footerPages={footerPages} footerFullView>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: Colors.rgba(Colors.$backgroundNeutralIdle, 0.5) },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          pointerEvents="box-only"
          accessibilityRole="button"
          accessibilityLabel="Dismiss toast"
          onPress={() => router.back()}
        />
        <Footer card={cardData} onLockedChange={() => router.back()} />
      </View>
    </CardDetailsProvider>
  )
}
