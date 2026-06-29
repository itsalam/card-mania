import { useEditCollection } from '@/client/collections/mutate'
import { EditCollectionResult } from '@/client/collections/types'
import { useToast } from '@/components/Toast'
import { useInputColors } from '@/components/ui/input/provider'
import { Switch } from '@/components/ui/switch'
import { Text } from '@/components/ui/text/base-text'
import { useCreateNewCollections } from '@/features/tcg-card-views/DetailCardView/provider'
import { CopyX, LucideIcon, NotebookText, Store } from 'lucide-react-native'
import React, { ReactNode } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { CreateCollectionInput } from './input'

// ── Shared row component for settings ─────────────────────────────────────────

export const SettingRow = ({
  icon: Icon,
  label,
  description,
  right,
}: {
  icon: LucideIcon
  label: ReactNode
  description?: string
  right?: ReactNode
}) => (
  <View style={rowStyles.row}>
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.15),
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.3),
      }}
    >
      <Icon size={17} color={Colors.$backgroundPrimaryHeavy} />
    </View>
    <View style={{ flex: 1, gap: 1 }}>
      <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.$textDefault }}>{label}</Text>
      {description && (
        <Text style={{ fontSize: 12, color: Colors.$textNeutral, lineHeight: 16 }}>
          {description}
        </Text>
      )}
    </View>
    {right}
  </View>
)

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
})

// ── Inputs ─────────────────────────────────────────────────────────────────────

const AnimNotebookText = Animated.createAnimatedComponent(NotebookText)

const ANotebookText = () => {
  const { color } = useInputColors()
  //@ts-ignore
  return <AnimNotebookText size={22} color={color} />
}

export const CollectionsNameInput = () => {
  const collectionName = useCreateNewCollections((s) => s.name)
  const setCollectionName = useCreateNewCollections((s) => s.setName)

  return (
    <CreateCollectionInput
      placeholder="Name"
      style={{ fontSize: 20, lineHeight: 24, margin: 2 }}
      floatingPlaceholderStyle={{ fontSize: 14, lineHeight: 16 }}
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

export const CollectionsDescriptionInput = () => {
  const description = useCreateNewCollections((s) => s.description)
  const setDescription = useCreateNewCollections((s) => s.setDescription)
  return (
    <CreateCollectionInput
      placeholder="Description"
      containerStyle={{
        backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
        margin: 0,
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

// ── Storefront options ─────────────────────────────────────────────────────────

export const StorefrontOptions = () => {
  const isStoreFront = useCreateNewCollections(({ isStoreFront }) => isStoreFront)
  const hideSoldItems = useCreateNewCollections(({ hideSoldItems }) => hideSoldItems)
  const setStoreOptions = useCreateNewCollections(({ setStoreOptions }) => setStoreOptions)

  return (
    <View style={{ gap: 14 }}>
      <SettingRow
        icon={Store}
        label="Storefront"
        description="Items are publicly searchable for sale."
        right={
          <Switch
            checked={Boolean(isStoreFront)}
            onCheckedChange={(val) => setStoreOptions({ isStoreFront: val })}
          />
        }
      />
      {isStoreFront && (
        <Animated.View
          entering={FadeInUp.withInitialValues({ transform: [{ translateY: -4 }] })}
          exiting={FadeOut}
        >
          <SettingRow
            icon={CopyX}
            label="Hide Sold Items"
            description="Sold items won't appear in your storefront."
            right={
              <Switch
                checked={Boolean(hideSoldItems)}
                onCheckedChange={(val) => setStoreOptions({ hideSoldItems: val })}
              />
            }
          />
        </Animated.View>
      )}
    </View>
  )
}

// ── Submit button ──────────────────────────────────────────────────────────────

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
  const { showToast } = useToast()

  const handlePress = () => {
    if (!validate()) return
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
      .catch(() => {
        showToast({
          title: 'Error',
          message: 'Failed to save collection. Please try again.',
          preset: 'failure',
        })
      })
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={submit.isPending}
      activeOpacity={0.75}
      style={{
        borderRadius: 999,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: submit.isPending
          ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.5)
          : Colors.$backgroundPrimaryHeavy,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.2 }}>
        {submit.isPending ? 'Saving…' : collectionId ? 'Save Changes' : 'Create Collection'}
      </Text>
    </TouchableOpacity>
  )
}
