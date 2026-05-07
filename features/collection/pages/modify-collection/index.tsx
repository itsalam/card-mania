import { ScrollView, View } from 'react-native'

import { CollectionLike, EditCollectionResult } from '@/client/collections/types'
import { Separator } from '@/components/ui/separator'
import { ModifyCollectionProvider } from '@/features/tcg-card-views/DetailCardView/provider'
import { ChevronLeft } from 'lucide-react-native'
import { TouchableOpacity } from 'react-native-ui-lib'
import { useCollectionsPageStore } from '../../provider'
import {
  CollectionsDescriptionInput,
  CollectionsNameInput,
  StorefrontOptions,
  SubmitCollectionButton,
} from './components'
import { CreateCollectionChipInput } from './tags-input'
import { VisibilitySelector } from './visibility-selector'

export const ModifyCollectionView = ({
  collection,
  onChange,
  onSubmit,
}: {
  collection?: CollectionLike
  onChange?: (c: CollectionLike) => void
  onSubmit?: (res: EditCollectionResult) => void
}) => {
  const { currentPage, setCurrentPage, setShowEditView } = useCollectionsPageStore()

  return (
    //@ts-ignore
    <ModifyCollectionProvider collection={collection} onChange={onChange}>
      <ScrollView
        style={{
          flex: 1,
        }}
        contentContainerStyle={{
          flexDirection: 'column',
          paddingVertical: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
          <TouchableOpacity
            onPress={() => {
              setShowEditView(false)
              if (currentPage === 'new') {
                setCurrentPage('default')
              }
            }}
            style={{
              padding: 7,
            }}
          >
            <ChevronLeft size={32} />
          </TouchableOpacity>
          <CollectionsNameInput />
        </View>
        <Separator style={{ marginVertical: 8 }} orientation="horizontal" />
        <View style={{ gap: 12, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }}>
            <CollectionsDescriptionInput />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <CreateCollectionChipInput />
          </View>
          <Separator style={{ marginHorizontal: 20, marginVertical: 8 }} orientation="horizontal" />
          <View
            style={{
              gap: 16,
              marginHorizontal: 20,
            }}
          >
            <VisibilitySelector />
            <StorefrontOptions />
          </View>
        </View>
      </ScrollView>
      <View className="w-full flex flex-row pt-2 gap-4 px-4 z-1 mb-4">
        <SubmitCollectionButton
          collectionId={collection?.id}
          onSubmit={(e) => {
            onSubmit?.(e)
          }}
        />
      </View>
    </ModifyCollectionProvider>
  )
}
