import { ScrollView, View } from 'react-native'

import { CollectionLike, EditCollectionResult } from '@/client/collections/types'
import { Separator } from '@/components/ui/separator'
import { ModifyCollectionProvider } from '@/features/tcg-card-views/DetailCardView/provider'
import { ChevronLeft } from 'lucide-react-native'
import { TouchableOpacity } from 'react-native-ui-lib'
import { FooterStyles as styles } from '../../../tcg-card-views/DetailCardView/footer/components/styles'
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
  const { currentPage, setCurrentPage, preferenceState, showEditView, setShowEditView } =
    useCollectionsPageStore()

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
        <View
          style={[
            styles.inputContainer,
            { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
          ]}
        >
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
        <View style={[{ paddingRight: 0, gap: 12, paddingBottom: 12 }]}>
          <View
            style={[
              styles.formContainer,
              styles.inputContainer,
              {
                flexDirection: 'row',
                alignItems: 'center',
              },
            ]}
          >
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
          <Separator
            style={{ marginLeft: 30, marginRight: 52, marginVertical: 8 }}
            orientation="horizontal"
          />
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
