// Collection appearance editor (ITS-98): accent color, icon, background image, with a live
// preview of the collection card above the controls.
//
// Design refs (Mobbin):
// - Neo Financial, live preview above a row of color swatches:
//   https://mobbin.com/screens/8cd78a36-60e4-4bc6-aa63-e946b40d059e
// - Perplexity, icon options as a tile grid with a selected state:
//   https://mobbin.com/screens/96806c31-9bf1-4bec-b07f-b2ffe091a8aa
// - Joi, preview-first appearance screen:
//   https://mobbin.com/screens/07ed8fc2-60f0-4a7a-ad57-6f43326009bc
import { useUploadCollectionBackground } from '@/client/collections/photos'
import {
  COLLECTION_ACCENTS,
  COLLECTION_ICONS,
  collectionAccentColor,
} from '@/components/collections/appearance'
import { CollectionsAvatar } from '@/components/collections/avatar'
import { CollectionBackground } from '@/components/collections/background'
import { CollectionCard } from '@/components/collections/collection-card'
import { Text } from '@/components/ui/text/base-text'
import { useCreateNewCollections } from '@/features/tcg-card-views/DetailCardView/provider'
import * as ImagePicker from 'expo-image-picker'
import { Ban, ImagePlus, RefreshCw, Trash2 } from 'lucide-react-native'
import React from 'react'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { Colors, TouchableOpacity } from 'react-native-ui-lib'

const SWATCH = 30
const ICON_TILE = 42

/** The name-row avatar on the edit form, reflecting the draft icon/color as they change. */
export function DraftCollectionAvatar({ coverImageUrl }: { coverImageUrl?: string | null }) {
  const iconKey = useCreateNewCollections((s) => s.iconKey)
  const accentColor = useCreateNewCollections((s) => s.accentColor)
  return (
    <CollectionsAvatar
      iconImageSrc={coverImageUrl ?? undefined}
      iconKey={iconKey}
      accentColor={accentColor}
    />
  )
}

export function AppearanceEditor() {
  const name = useCreateNewCollections((s) => s.name)
  const description = useCreateNewCollections((s) => s.description)
  const visibility = useCreateNewCollections((s) => s.visibility)
  const iconKey = useCreateNewCollections((s) => s.iconKey)
  const accentColor = useCreateNewCollections((s) => s.accentColor)
  const backgroundImageId = useCreateNewCollections((s) => s.backgroundImageId)
  const setAppearance = useCreateNewCollections((s) => s.setAppearance)

  return (
    <View style={{ gap: 16 }}>
      <View pointerEvents="none">
        <CollectionCard
          collection={{
            name: name || 'Collection name',
            description,
            visibility,
            icon_key: iconKey,
            accent_color: accentColor,
            background_image_id: backgroundImageId,
          }}
          onPress={() => {}}
        />
      </View>

      <Group label="Color">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Swatch selected={!accentColor} onPress={() => setAppearance({ accentColor: null })} />
          {COLLECTION_ACCENTS.map((key) => (
            <Swatch
              key={key}
              color={collectionAccentColor(key)}
              selected={accentColor === key}
              onPress={() => setAppearance({ accentColor: key })}
            />
          ))}
        </View>
      </Group>

      <Group label="Icon">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {COLLECTION_ICONS.map(({ key, icon: Icon }) => {
            const selected = iconKey === key
            const tint = collectionAccentColor(accentColor) ?? Colors.$backgroundPrimaryHeavy
            return (
              <Pressable
                key={key}
                accessibilityLabel={`${key} icon`}
                accessibilityState={{ selected }}
                // Tapping the selected icon clears it back to the default.
                onPress={() => setAppearance({ iconKey: selected ? null : key })}
                style={{
                  width: ICON_TILE,
                  height: ICON_TILE,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? tint : Colors.rgba(Colors.$outlineNeutral, 0.4),
                  backgroundColor: selected ? Colors.rgba(tint, 0.16) : 'transparent',
                }}
              >
                <Icon size={18} color={selected ? tint : Colors.$iconNeutral} />
              </Pressable>
            )
          })}
        </View>
      </Group>

      <Group label="Background">
        <BackgroundPicker
          imageId={backgroundImageId}
          accentColor={accentColor}
          onChange={(id) => setAppearance({ backgroundImageId: id })}
        />
      </Group>
    </View>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '500', color: Colors.$textNeutral }}>{label}</Text>
      {children}
    </View>
  )
}

function Swatch({
  color,
  selected,
  onPress,
}: {
  /** Undefined renders the "no accent" swatch. */
  color?: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected }}
      accessibilityLabel={color ? 'accent color' : 'no accent color'}
      style={{
        width: SWATCH + 8,
        height: SWATCH + 8,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: selected ? Colors.$textDefault : 'transparent',
      }}
    >
      <View
        style={{
          width: SWATCH,
          height: SWATCH,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: color ?? Colors.$backgroundNeutral,
          borderWidth: 1,
          borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
        }}
      >
        {!color && <Ban size={14} color={Colors.$iconNeutral} />}
      </View>
    </Pressable>
  )
}

function BackgroundPicker({
  imageId,
  accentColor,
  onChange,
}: {
  imageId: string | null
  accentColor: string | null
  onChange: (id: string | null) => void
}) {
  const upload = useUploadCollectionBackground()

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    })
    if (result.canceled || !result.assets[0]) return
    upload.mutate(result.assets[0], { onSuccess: (id) => onChange(id) })
  }

  if (upload.isPending) {
    return (
      <View style={[pickerBox(), { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.$iconNeutral} />
        <Text style={{ fontSize: 12, color: Colors.$textNeutral, marginTop: 6 }}>Uploading…</Text>
      </View>
    )
  }

  if (!imageId) {
    return (
      <TouchableOpacity
        onPress={pick}
        activeOpacity={0.75}
        style={[pickerBox(), { alignItems: 'center', justifyContent: 'center', gap: 6 }]}
      >
        <ImagePlus size={20} color={Colors.$iconNeutral} />
        <Text style={{ fontSize: 13, color: Colors.$textNeutral }}>Add a background photo</Text>
        {upload.isError && (
          <Text style={{ fontSize: 12, color: Colors.$textDanger }}>
            Upload failed — try again.
          </Text>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={[pickerBox(), { overflow: 'hidden', borderStyle: 'solid' }]}>
        <CollectionBackground imageId={imageId} accentColor={accentColor} variant="thumb" />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PillButton icon={RefreshCw} label="Change" onPress={pick} />
        <PillButton icon={Trash2} label="Remove" onPress={() => onChange(null)} danger />
      </View>
    </View>
  )
}

// A function (not a constant) so Colors resolve against the active theme at render time.
const pickerBox = () => ({
  height: 96,
  borderRadius: 12,
  borderWidth: 1,
  borderStyle: 'dashed' as const,
  borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
})

function PillButton({
  icon: Icon,
  label,
  onPress,
  danger,
}: {
  icon: typeof Trash2
  label: string
  onPress: () => void
  danger?: boolean
}) {
  const color = danger ? Colors.$textDanger : Colors.$textDefault
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
      }}
    >
      <Icon size={14} color={color} />
      <Text style={{ fontSize: 13, color }}>{label}</Text>
    </TouchableOpacity>
  )
}
