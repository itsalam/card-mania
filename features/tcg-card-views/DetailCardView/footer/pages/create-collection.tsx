import { CollectionsPreviewIcon } from '@/features/collection/components/PreviewIcon'

import { ArrowLeft } from 'lucide-react-native'
import { Dimensions, ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

import { BlurBackground } from '@/components/Background'
import { Separator } from '@/components/ui/separator'
import {
  ModifyCollectionProvider,
  useCardDetails,
} from '@/features/tcg-card-views/DetailCardView/provider'

import {
  CollectionsDescriptionInput,
  CollectionsNameInput,
  StorefrontOptions,
  SubmitCollectionButton,
} from '@/features/collection/pages/modify-collection/components'
import { CreateCollectionChipInput } from '@/features/collection/pages/modify-collection/tags-input'
import { VisibilitySelector } from '@/features/collection/pages/modify-collection/visibility-selector'
import { qk } from '@/lib/store/functions/helpers'
import { useQueryClient } from '@tanstack/react-query'
import { FooterButton } from '../components/button'
import { FooterStyles as styles } from '../components/styles'

const { width } = Dimensions.get('window')

export const CreateCollectionView = () => {
  const { setPage, card } = useCardDetails()
  const qc = useQueryClient()

  return (
    <ModifyCollectionProvider>
      <ScrollView
        style={{
          flex: 1,
        }}
        contentContainerClassName="flex flex-col pl-2"
      >
        <View className="flex items-center justify-center mt-8 pb-4">
          <CollectionsPreviewIcon width={width * 0.23} />
        </View>
        <View style={[styles.formContainer, { paddingVertical: 8, marginRight: 12 }]}>
          <CollectionsNameInput />
        </View>
        <Separator
          style={{ marginLeft: 30, marginRight: 52, marginVertical: 8 }}
          orientation="horizontal"
        />
        <View style={[styles.formContainer, { paddingRight: 0, gap: 8, paddingBottom: 12 }]}>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
              marginRight: 22,
            }}
          >
            <CollectionsDescriptionInput />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
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
              marginRight: 22,
            }}
          >
            <VisibilitySelector />
            <StorefrontOptions />
          </View>
        </View>
      </ScrollView>
      <BlurBackground className="w-full flex flex-row pt-2 gap-4 px-4 z-1">
        <FooterButton
          highLighted
          style={{ flexGrow: 1, flex: 1, width: '100%' }}
          onPress={() => setPage(0)}
          label="Back"
          iconSource={(style) => <ArrowLeft style={style} color={Colors.$iconDefaultLight} />}
        />
        <SubmitCollectionButton
          onSubmit={() => {
            card &&
              qc.invalidateQueries({
                queryKey: qk.collectionForCard(card?.id),
              })

            setPage(0)
          }}
        />
      </BlurBackground>
    </ModifyCollectionProvider>
  )
}
