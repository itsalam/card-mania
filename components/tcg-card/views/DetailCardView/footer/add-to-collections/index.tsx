import { useViewCollectionsForCard } from '@/client/collections/query'
import { SearchBar } from '@/components/ui/search'
import { Text } from '@/components/ui/text'
import { PanelBottomClose, Plus } from 'lucide-react-native'
import React, { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useCardDetails } from '../../provider'
import { FooterButton } from '../components/button'
import { CollectionListItem } from './components'
// import { Label } from '@react-navigation/elements'

export const AddToCollectionsView = (props: { enabled?: boolean }) => {
  const { card, setPage, setFooterFullView } = useCardDetails()
  const [query, setQuery] = useState<string>()
  const { data: collection } = useViewCollectionsForCard(card?.id, query)

  return (
    <>
      <SearchBar onChangeText={setQuery} />
      <View className="w-full grow pt-8">
        <ScrollView>
          {!!collection?.included.length && (
            <>
              <Text>Saved In</Text>
              <View className="py-2 flex flex-col gap-4">
                {collection?.included.map((c) => (
                  <CollectionListItem key={c.id} collection={c} />
                ))}
              </View>
            </>
          )}
          {!!collection?.excluded && (
            <>
              <Text className="pt-4">Other Collections</Text>
              <View className="py-2 flex flex-col gap-4">
                {collection?.excluded.length ? (
                  collection?.excluded.map((c) => <CollectionListItem key={c.id} collection={c} />)
                ) : (
                  <View className="pt-4 flex items-center justify-center">
                    <Text className="text-sm text-muted-foreground italic">
                      No other collections
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
      <View className="w-full flex flex-row pt-4 gap-4 px-4">
        <FooterButton
          highLighted
          style={{ flexGrow: 1, flex: 1, width: '100%' }}
          onPress={() => setPage(1)}
          label="New Collection"
          iconSource={(style) => <Plus style={style} color={Colors.$iconDefaultLight} />}
        />
        <FooterButton
          style={{
            flexShrink: 1,
            backgroundColor: Colors.$backgroundPrimaryMedium,
          }}
          onPress={() => setFooterFullView(false)}
          label="Done"
          iconSource={(style) => (
            <PanelBottomClose color={Colors.$iconDefaultLight} style={style} />
          )}
        />
      </View>
    </>
  )
}
