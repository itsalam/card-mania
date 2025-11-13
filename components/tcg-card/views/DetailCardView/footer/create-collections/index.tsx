import { CollectionsPreviewIcon } from '@/features/collection/components/PreviewIcon'

import { useEditCollection } from '@/client/collections/mutate'
import { ArrowLeft, NotebookText, PanelBottomClose } from 'lucide-react-native'
import { Dimensions, ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

import {
  CreateNewCollectionsProvider,
  useCardDetails,
  useCreateNewCollections,
} from '@/components/tcg-card/views/DetailCardView/provider'
import { Input } from '@/components/ui/input/base-input'
import { useInputColors } from '@/components/ui/input/provider'
import Animated from 'react-native-reanimated'
import { thumbStyles } from '../../ui'
import { FooterButton } from '../components/button'
import { FooterStyles as styles } from '../components/styles'
import { CreateCollectionInput } from './input'
import { CreateCollectionChipInput } from './tags-input'
import { VisibilitySelector } from './visibility-selector'

const { width } = Dimensions.get('window')

const CollectionsNameInput = () => {
  const collectionName = useCreateNewCollections((s) => s.name)
  const setCollectionName = useCreateNewCollections((s) => s.setName)

  return (
    <CreateCollectionInput
      placeholder={'Name'}
      style={[styles.titleInputBody]}
      containerStyle={{
        backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
      }}
      value={collectionName}
      onChangeText={setCollectionName}
      validateOnBlur
      validate={['required', (value) => (value ? value.length > 3 : true)]}
      validationMessage={['Name is required', 'Name must be at least 4 characters']}
      showClearButton
      floatingPlaceholder
    />
  )
}

const AnimNotebookText = Animated.createAnimatedComponent(NotebookText)

const ANotebookText = () => {
  const { color } = useInputColors()
  //@ts-ignore
  return <AnimNotebookText size={28} color={color} />
}

const CollectionsDescriptionInput = () => {
  const description = useCreateNewCollections((s) => s.description)
  const setDescription = useCreateNewCollections((s) => s.setDescription)
  return (
    <CreateCollectionInput
      containerStyle={{
        backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
      }}
      placeholder={'Description'}
      value={description}
      onChangeText={setDescription}
      floatingPlaceholder
      showCharCounter
      showClearButton
      multiline
      leadingAccessory={<ANotebookText />}
      maxLength={120}
    >
      {(props, ref) => (
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
            marginRight: 12,
          }}
        >
          <Input {...props} ref={ref} />
        </View>
      )}
    </CreateCollectionInput>
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

  const W = Dimensions.get('window').width

  return (
    <CreateNewCollectionsProvider>
      <ScrollView
        style={{
          flex: 1,
        }}
        contentContainerClassName="flex flex-col gap-2 px-2"
      >
        <View className="flex items-center justify-center mt-12 pb-4 flex-1">
          <CollectionsPreviewIcon width={width * 0.33} />
        </View>
        <View style={[styles.formContainer, { paddingVertical: 8 }]}>
          <CollectionsNameInput />
        </View>
        <View style={[styles.formContainer, { paddingRight: 0, gap: 8, paddingBottom: 12 }]}>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
              marginRight: 12,
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
          <VisibilitySelector />
        </View>
      </ScrollView>
      <View
        className="pt-4 px-4 gap-4 border-t-2 border-l-2 border-r-2"
        style={[
          thumbStyles.sheet,
          {
            width: W + 4,
            left: -2,
            flexDirection: 'row',
            borderBottomWidth: 0,
          },
        ]}
      >
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
