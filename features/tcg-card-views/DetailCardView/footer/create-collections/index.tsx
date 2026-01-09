import { CollectionsPreviewIcon } from '@/features/collection/components/PreviewIcon'

import { useEditCollection } from '@/client/collections/mutate'
import { ArrowLeft, CopyX, NotebookText, PanelBottomClose, Store } from 'lucide-react-native'
import { Dimensions, ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

import { BlurBackground } from '@/components/Background'
import { Input } from '@/components/ui/input/base-input'
import { useInputColors } from '@/components/ui/input/provider'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  CreateNewCollectionsProvider,
  useCardDetails,
  useCreateNewCollections,
} from '@/features/tcg-card-views/DetailCardView/provider'
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated'
import { FooterButton } from '../components/button'
import { FooterStyles as styles } from '../components/styles'
import { OptionLabel } from './components'
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
      style={[styles.titleInputBody, { padding: 2 }]}
      floatingPlaceholderStyle={styles.titleFloatingPlaceholderStyle}
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
  const hideSoldItems = useCreateNewCollections((s) => s.hideSoldItems)
  const isStoreFront = useCreateNewCollections((s) => s.isStoreFront)
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
        if (validate()) {
          submit
            .mutateAsync({
              name,
              description,
              visibility,
              tags: tags.map((t) => t.id).filter(Boolean) as string[],
              is_storefront: isStoreFront,
              hide_sold_items: hideSoldItems,
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

const StorefrontOptions = () => {
  const isStoreFront = useCreateNewCollections(({ isStoreFront }) => isStoreFront)
  const hideSoldItems = useCreateNewCollections(({ hideSoldItems }) => hideSoldItems)
  const setStoreOptions = useCreateNewCollections(({ setStoreOptions }) => setStoreOptions)

  return (
    <View style={{ gap: 14, width: '100%' }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <OptionLabel
          style={{ flex: 0.8, flexShrink: 1 }}
          icon={Store}
          label={'Storefront'}
          description="Items are searchable for sales (if public)."
        />
        <Switch
          checked={Boolean(isStoreFront)}
          onCheckedChange={(isStoreFront) => setStoreOptions({ isStoreFront })}
        />
      </View>
      {isStoreFront && (
        <Animated.View
          entering={FadeInUp.withInitialValues({ transform: [{ translateY: -5 }] })}
          exiting={FadeOut}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <OptionLabel
            style={{ flex: 0.8, flexShrink: 1 }}
            icon={CopyX}
            label={'Hide Sold Items'}
            description="Sold Items are not searchable/viewable."
          />
          <Switch
            checked={Boolean(hideSoldItems)}
            onCheckedChange={(hideSoldItems) => setStoreOptions({ hideSoldItems })}
          />
        </Animated.View>
      )}
    </View>
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
        <SubmitCollectionButton />
      </BlurBackground>
    </CreateNewCollectionsProvider>
  )
}
