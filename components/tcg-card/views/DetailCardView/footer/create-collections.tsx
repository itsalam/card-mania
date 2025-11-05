import { CollectionsPreviewIcon } from '@/features/collection/components/PreviewIcon'

import { useEditCollection } from '@/client/collections/mutate'
import { ArrowLeft, NotebookText, PanelBottomClose, Tag } from 'lucide-react-native'
import { Dimensions, ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { CreateNewCollectionsProvider, useCardDetails, useCreateNewCollections } from '../provider'
import { FooterButton } from './components/button'
import { CreateCollectionInput, FPStyle } from './components/input'
import { FooterStyles as styles } from './components/styles'
import { CreateCollectionChipInput } from './components/tags-input'
import { VisibilitySelector } from './components/visibility-selector'

const { width } = Dimensions.get('window')

const CollectionsNameInput = () => {
  const collectionName = useCreateNewCollections((s) => s.name)
  const setCollectionName = useCreateNewCollections((s) => s.setName)

  return (
    <CreateCollectionInput
      placeholder={'Add a Name...'}
      style={[styles.titleInputBody]}
      value={collectionName}
      onChangeText={setCollectionName}
      validateOnChange
      validateOnBlur
      validate={['required', (value) => (value ? value.length > 3 : true)]}
      validationMessage={['Name is required', 'Name must be at least 4 characters']}
      containerStyle={{ flex: 1 }}
      showClearButton
    />
  )
}

const CollectionsDescriptionInput = () => {
  const description = useCreateNewCollections((s) => s.description)
  const setDescription = useCreateNewCollections((s) => s.setDescription)
  return (
    <CreateCollectionInput
      multiline
      placeholder={'Description'}
      value={description}
      onChangeText={setDescription}
      style={[styles.attributeInputBody]}
      floatingPlaceholderStyle={(hasInput) =>
        ({
          ...styles.attributeInputBody,
          ...(hasInput ? styles.attributeFloatingPlaceholderStyle : {}),
        } as FPStyle)
      }
      floatingPlaceholder
      showCharCounter
      showClearButton
      containerStyle={{ flex: 1 }}
      maxLength={120}
    />
  )
}

const SubmitCollectionButton = () => {
  const name = useCreateNewCollections((s) => s.name)
  const description = useCreateNewCollections((s) => s.description)
  const tags = useCreateNewCollections((s) => s.tags)
  const visibility = useCreateNewCollections((s) => s.visibility)
  const validate = useCreateNewCollections((s) => s.validate)
  const { setPage, card } = useCardDetails()
  const submit = useEditCollection(undefined, card?.id)
  return (
    <FooterButton
      style={{
        flexShrink: 1,
        backgroundColor: Colors.$backgroundPrimaryMedium,
      }}
      onPress={() => {
        console.log('Submitting new collection:', { name, description, visibility, tags })
        if (validate()) {
          submit
            .mutateAsync({
              name,
              description,
              visibility,
              tags: tags.map((t) => t.id).filter(Boolean) as string[],
            })
            .then(() => setPage(0))
            .catch((e) => console.error('Error creating collection:', e))
        }
      }}
      label="Done"
      iconSource={(style) => <PanelBottomClose color={Colors.$iconDefaultLight} style={style} />}
    />
  )
}

export const CreateCollectionView = () => {
  const { card, setPage, setFooterFullView } = useCardDetails()

  return (
    <CreateNewCollectionsProvider>
      <ScrollView
        style={{
          flex: 1,
        }}
        contentContainerClassName="w-full flex flex-col gap-2 grow overflow-hidden"
      >
        <View className="flex grow items-center justify-center mt-12 pb-4">
          <CollectionsPreviewIcon width={width * 0.33} />
        </View>
        <View style={[styles.formContainer, { paddingTop: 16 }]}>
          <CollectionsNameInput />
        </View>
        <View style={[styles.formContainer, { paddingVertical: 12, paddingBottom: 20 }]}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <NotebookText size={24} color={Colors.$textNeutralLight} />
            <CollectionsDescriptionInput />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Tag size={24} color={Colors.$textNeutralLight} style={{ marginTop: 18 }} />
            <CreateCollectionChipInput />
          </View>
          <VisibilitySelector />
        </View>
      </ScrollView>
      <View className="w-full flex flex-row pt-4 gap-4">
        <FooterButton
          highLighted
          style={{ flexGrow: 1, flex: 1, width: '100%' }}
          onPress={() => setPage(0)}
          label="Back"
          iconSource={(style) => <ArrowLeft style={style} color={Colors.$iconDefaultLight} />}
        />
        <SubmitCollectionButton />
      </View>
    </CreateNewCollectionsProvider>
  )
}
