import { useViewCollectionsForCard } from '@/client/collections/query'
import { BlurBackground } from '@/components/Background'
import { ExpandableCollectionEntryListItem } from '@/components/collections/items/expandable-entry-item'
import { SearchBar } from '@/components/ui/search'
import { Text } from '@/components/ui/text'
import { PanelBottomClose, Plus } from 'lucide-react-native'
import React, { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Colors, Spacings } from 'react-native-ui-lib'
import { useCardDetails } from '../../../provider'
import { FooterButton } from '../../components/button'
// import { Label } from '@react-navigation/elements'

export const AddToCollectionsView = () => {
  const { card, setPage, setFooterFullView } = useCardDetails()
  const [query, setQuery] = useState<string>()
  const { data: collection } = useViewCollectionsForCard(card?.id, query)

  return (
    <>
      <ScrollView
        style={{
          flex: 1,
          width: '100%',
          overflow: 'visible',
          paddingTop: Spacings.s2,
          display: 'flex',
          gap: Spacings.s2,
        }}
      >
        <View
          style={{
            width: '100%',
            paddingHorizontal: Spacings.s4,
          }}
        >
          <SearchBar onChangeText={setQuery} />
        </View>
        {!!collection?.included.length && (
          <>
            <Text style={{ paddingHorizontal: Spacings.s4 }}>Saved In</Text>
            <View className="py-2 flex flex-col">
              {collection?.included.map((c) => (
                <ExpandableCollectionEntryListItem
                  card={card ?? undefined}
                  key={c.id}
                  collection={c}
                />
              ))}
            </View>
          </>
        )}
        {!!collection?.excluded && (
          <>
            <Text style={{ paddingHorizontal: Spacings.s4 }}>Other Collections</Text>
            <View className="py-2 flex flex-col">
              {collection?.excluded.length ? (
                collection?.excluded.map((c) => (
                  <ExpandableCollectionEntryListItem
                    card={card ?? undefined}
                    key={c.id}
                    collection={c}
                  />
                ))
              ) : (
                <View className="pt-4 flex items-center justify-center">
                  <Text className="text-sm text-muted-foreground italic">No other collections</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
      <BlurBackground className="w-full flex flex-row pt-2 gap-4 px-4">
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
      </BlurBackground>
    </>
  )
}
