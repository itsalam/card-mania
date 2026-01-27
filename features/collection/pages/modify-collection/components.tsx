import { useEditCollection } from '@/client/collections/mutate'
import { Text } from '@/components/ui/text'
import {
  CircleQuestionMark,
  CopyX,
  LucideIcon,
  NotebookText,
  PanelBottomClose,
  Store,
} from 'lucide-react-native'
import { ReactNode, useState } from 'react'
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native'
import { Button, Colors, Hint, HintProps } from 'react-native-ui-lib'
import { HintPositions } from 'react-native-ui-lib/src/components/hint/types'

import { EditCollectionResult } from '@/client/collections/types'
import { useInputColors } from '@/components/ui/input/provider'
import { Switch } from '@/components/ui/switch'
import { useCreateNewCollections } from '@/features/tcg-card-views/DetailCardView/provider'
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated'
import { FooterButton } from '../../../tcg-card-views/DetailCardView/footer/components/button'
import { FooterStyles as styles } from '../../../tcg-card-views/DetailCardView/footer/components/styles'
import { CreateCollectionInput } from './input'

export const OptionLabel = ({
  icon: Icon,
  label,
  hintProps,
  description,
  style,
}: {
  icon: LucideIcon
  description?: string
  label: ReactNode
  hintProps?: HintProps
  style?: StyleProp<ViewStyle>
}) => {
  const [toggleHint, setToggleHint] = useState(false)
  const { onBackgroundPress, ...rest } = hintProps ?? {}

  return (
    <View
      style={[
        {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        style,
      ]}
    >
      <TouchableOpacity
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
        {...(hintProps
          ? {
              onPress: () => {
                setToggleHint(!toggleHint)
              },
            }
          : {
              disabled: true,
              activeOpacity: 1,
            })}
      >
        <Icon color={Colors.$textNeutralLight} size={30} />
        <View>
          <View
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text
              style={[
                {
                  color: Colors.$textNeutralLight,
                  fontSize: 20,
                  lineHeight: 24,
                  fontWeight: '500',
                },
              ]}
            >
              {label}
            </Text>
            {hintProps && (
              <Hint
                visible={toggleHint}
                useModal
                position={HintPositions.TOP}
                onBackgroundPress={(e) => {
                  onBackgroundPress?.(e)
                  setToggleHint(false)
                }}
                {...rest}
              >
                <Button
                  onPress={() => {
                    setToggleHint(!toggleHint)
                  }}
                  size="large"
                  iconSource={(style) => (
                    <CircleQuestionMark style={style} color={Colors.$iconDefaultLight} />
                  )}
                />
              </Hint>
            )}
          </View>
          {description && (
            <Text
              numberOfLines={2}
              style={[
                {
                  color: Colors.$textNeutralLight,
                  fontSize: 10,
                  lineHeight: 12,
                  fontWeight: '500',
                  flexShrink: 1,
                },
              ]}
            >
              {description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  )
}

export const CollectionsNameInput = () => {
  const collectionName = useCreateNewCollections((s) => s.name)
  const setCollectionName = useCreateNewCollections((s) => s.setName)

  return (
    <CreateCollectionInput
      placeholder={'Name'}
      style={[styles.titleInputBody, { padding: 2 }]}
      floatingPlaceholderStyle={styles.titleFloatingPlaceholderStyle}
      containerStyle={{
        backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
        margin: 0,
      }}
      value={collectionName}
      onChangeText={setCollectionName}
      floatingPlaceholder
      showCharCounter
      validate={['required', (value) => (value ? value.length > 3 : true)]}
      validationMessage={['Name is required', 'Name must be at least 4 characters']}
      showClearButton
    />
  )
}

const AnimNotebookText = Animated.createAnimatedComponent(NotebookText)

const ANotebookText = () => {
  const { color } = useInputColors()
  //@ts-ignore
  return <AnimNotebookText size={28} color={color} />
}

export const CollectionsDescriptionInput = () => {
  const description = useCreateNewCollections((s) => s.description)
  const setDescription = useCreateNewCollections((s) => s.setDescription)
  return (
    <CreateCollectionInput
      placeholder={'Description'}
      containerStyle={{
        backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
      }}
      value={description}
      onChangeText={setDescription}
      floatingPlaceholder
      showCharCounter
      showClearButton
      leadingAccessory={<ANotebookText />}
      maxLength={120}
    />
  )
}

export const SubmitCollectionButton = ({
  onSubmit,
  collectionId,
}: {
  onSubmit?: (res: EditCollectionResult) => void
  collectionId?: string
}) => {
  const name = useCreateNewCollections((s) => s.name)
  const description = useCreateNewCollections((s) => s.description)
  const hideSoldItems = useCreateNewCollections((s) => s.hideSoldItems)
  const isStoreFront = useCreateNewCollections((s) => s.isStoreFront)
  const tags = useCreateNewCollections((s) => s.tags)
  const visibility = useCreateNewCollections((s) => s.visibility)
  const validate = useCreateNewCollections((s) => s.validate)
  const submit = useEditCollection(collectionId)
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
            .then((res) => onSubmit?.(res))
            .catch((e) => console.error('Error creating collection:', e))
        } else {
          //TODO: Alert the improper state
        }
      }}
      label="Done"
      iconSource={(style) => <PanelBottomClose color={Colors.$iconDefaultLight} style={style} />}
    />
  )
}

export const StorefrontOptions = () => {
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
