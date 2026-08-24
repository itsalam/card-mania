import {
  CollectionItemImage,
  MAX_PHOTOS_PER_ITEM,
  useCollectionItemPhotos,
  useDeleteCollectionItemPhoto,
  useSetPrimaryCollectionItemPhoto,
  useUploadCollectionItemPhoto,
} from '@/client/collections/photos'
import { useImageProxy } from '@/client/image-proxy'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text'
import * as ImagePicker from 'expo-image-picker'
import { Camera, Check, ImageIcon, Plus, Star, Trash2, X } from 'lucide-react-native'
import { ReactNode, useState } from 'react'
import { ActivityIndicator, Image, Pressable, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

const TILE_SIZE = 88

type StagedAsset = ImagePicker.ImagePickerAsset

/** Content-based identity so removing one staged asset never reshuffles another's key. */
const assetKey = (asset: StagedAsset) => asset.assetId ?? asset.uri

/**
 * Owns everything about turning picker output into uploaded photos: the
 * in-flight-upload count, the staged (not-yet-confirmed) multi-select
 * batch, and the pick/confirm/cancel actions that drive both.
 */
function usePhotoStaging(collectionItemId: string, savedCount: number) {
  const upload = useUploadCollectionItemPhoto(collectionItemId)
  // Tracks in-flight uploads that haven't landed in the photos query yet, so
  // the "+" tile and limit are correct the instant the picker returns.
  const [pendingCount, setPendingCount] = useState(0)
  // Multi-select stages assets here instead of uploading immediately, so the
  // user can review, add more, and confirm before committing a batch.
  const [selection, setSelection] = useState<StagedAsset[]>([])
  // Explicit user choice of which staged asset becomes primary.
  const [primaryOverride, setPrimaryOverride] = useState<string | null>(null)

  const isStaging = selection.length > 0
  const remainingSlots = MAX_PHOTOS_PER_ITEM - savedCount - pendingCount - selection.length
  const atLimit = remainingSlots <= 0

  // Respect an explicit tap as long as that asset is still staged; otherwise
  // default to the first staged asset only when there's no saved photo to
  // hold the title already.
  const overrideStillStaged =
    primaryOverride !== null && selection.some((asset) => assetKey(asset) === primaryOverride)
  const primaryAssetKey = overrideStillStaged
    ? primaryOverride
    : savedCount === 0 && selection.length > 0
      ? assetKey(selection[0])
      : null

  const uploadAssets = (assets: StagedAsset[], primaryKey: string | null) => {
    setPendingCount((n) => n + assets.length)
    assets.forEach((asset) => {
      upload.mutate(
        { asset, isPrimary: assetKey(asset) === primaryKey },
        { onSettled: () => setPendingCount((n) => Math.max(0, n - 1)) }
      )
    })
  }

  const pick = async (source: 'library' | 'camera') => {
    if (atLimit) return
    const permission =
      source === 'library'
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) return

    const result =
      source === 'library'
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
            allowsMultipleSelection: true,
            selectionLimit: remainingSlots,
          })
        : await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })

    if (result.canceled || result.assets.length === 0) return

    // Common case: nothing staged yet and exactly one photo picked — upload
    // right away rather than making the user confirm a single-photo "batch".
    if (!isStaging && result.assets.length === 1) {
      const [asset] = result.assets
      uploadAssets(result.assets, savedCount === 0 ? assetKey(asset) : null)
      return
    }

    // Once staging, every pick (single or multi) appends to the existing
    // batch rather than replacing it, so previously staged tiles keep their
    // position and identity.
    setSelection((prev) => {
      const known = new Set(prev.map(assetKey))
      const additions = result.assets.filter((asset) => !known.has(assetKey(asset)))
      return [...prev, ...additions]
    })
  }

  return {
    pendingCount,
    selection,
    isStaging,
    atLimit,
    primaryAssetKey,
    selectPrimary: (key: string) => setPrimaryOverride(key),
    clearPrimaryOverride: () => setPrimaryOverride(null),
    pickFromLibrary: () => pick('library'),
    pickFromCamera: () => pick('camera'),
    removeFromSelection: (key: string) =>
      setSelection((prev) => prev.filter((asset) => assetKey(asset) !== key)),
    confirmSelection: () => {
      uploadAssets(selection, primaryAssetKey)
      setSelection([])
      setPrimaryOverride(null)
    },
    cancelSelection: () => {
      setSelection([])
      setPrimaryOverride(null)
    },
  }
}

export function CollectionItemPhotosModal({
  visible,
  onDismiss,
  collectionItemId,
}: {
  visible: boolean
  onDismiss: () => void
  collectionItemId: string
}) {
  const { data: photos = [], isLoading } = useCollectionItemPhotos(collectionItemId)
  const remove = useDeleteCollectionItemPhoto(collectionItemId)
  const setPrimary = useSetPrimaryCollectionItemPhoto(collectionItemId)
  const {
    pendingCount,
    selection,
    isStaging,
    atLimit,
    primaryAssetKey,
    selectPrimary,
    clearPrimaryOverride,
    pickFromLibrary,
    pickFromCamera,
    removeFromSelection,
    confirmSelection,
    cancelSelection,
  } = usePhotoStaging(collectionItemId, photos.length)
  // The primary "cursor" is exclusive across saved and staged photos: while
  // a staged photo is chosen as primary, no saved photo should still show
  // as primary too, even though its DB row hasn't changed yet.
  const savedPrimarySuppressed = primaryAssetKey !== null

  return (
    <Modal visible={visible} onDismiss={onDismiss}>
      <View style={{ width: '100%', paddingTop: 4 }}>
        <ModalHeader
          onDismiss={onDismiss}
          canSave={isStaging}
          onSave={() => {
            confirmSelection()
            onDismiss()
          }}
        />
        <Separator orientation="horizontal" />

        <SavedPhotoGrid
          photos={photos}
          pendingCount={pendingCount}
          showAddTile={!isStaging && !atLimit && !isLoading}
          onAddTile={pickFromLibrary}
          primarySuppressed={savedPrimarySuppressed}
          onSetPrimary={(photo) => {
            setPrimary.mutate(photo.id)
            clearPrimaryOverride()
          }}
          onDelete={(photo) => remove.mutate(photo)}
          isDeleting={(photo) => remove.isPending && remove.variables?.id === photo.id}
        />

        {isStaging && (
          <StagedPhotoGroup
            assets={selection}
            primaryAssetKey={primaryAssetKey}
            canAddMore={!atLimit}
            onAddMore={pickFromLibrary}
            onSelectPrimary={selectPrimary}
            onRemove={removeFromSelection}
          />
        )}

        <PhotoActionBar
          isStaging={isStaging}
          selectionCount={selection.length}
          atLimit={atLimit}
          onPickLibrary={pickFromLibrary}
          onPickCamera={pickFromCamera}
          onConfirm={confirmSelection}
          onCancel={cancelSelection}
        />
      </View>
    </Modal>
  )
}

function ModalHeader({
  onDismiss,
  canSave,
  onSave,
}: {
  onDismiss: () => void
  canSave: boolean
  onSave: () => void
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
      }}
    >
      <Pressable onPress={onDismiss} hitSlop={8}>
        <X size={20} color={Colors.$iconNeutral} />
      </Pressable>
      <Text variant="h3">Photos</Text>
      <Pressable onPress={onSave} disabled={!canSave} hitSlop={8}>
        <Text
          style={{
            fontWeight: '600',
            color: canSave ? Colors.$textPrimary : Colors.$textDisabled,
          }}
        >
          Save
        </Text>
      </Pressable>
    </View>
  )
}

function SavedPhotoGrid({
  photos,
  pendingCount,
  showAddTile,
  onAddTile,
  primarySuppressed,
  onSetPrimary,
  onDelete,
  isDeleting,
}: {
  photos: CollectionItemImage[]
  pendingCount: number
  showAddTile: boolean
  onAddTile: () => void
  primarySuppressed: boolean
  onSetPrimary: (photo: CollectionItemImage) => void
  onDelete: (photo: CollectionItemImage) => void
  isDeleting: (photo: CollectionItemImage) => boolean
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 16 }}>
      {photos.map((photo) => (
        <PhotoTile
          key={photo.id}
          photo={photo}
          isPrimary={photo.is_primary && !primarySuppressed}
          onSetPrimary={() => onSetPrimary(photo)}
          onDelete={() => onDelete(photo)}
          isDeleting={isDeleting(photo)}
        />
      ))}
      {Array.from({ length: pendingCount }).map((_, i) => (
        <PendingPhotoTile key={`pending-${i}`} />
      ))}
      {showAddTile && <AddPhotoTile onPress={onAddTile} />}
    </View>
  )
}

/** Visually separated, elevated group for photos picked but not yet confirmed/uploaded. */
function StagedPhotoGroup({
  assets,
  primaryAssetKey,
  canAddMore,
  onAddMore,
  onSelectPrimary,
  onRemove,
}: {
  assets: StagedAsset[]
  primaryAssetKey: string | null
  canAddMore: boolean
  onAddMore: () => void
  onSelectPrimary: (key: string) => void
  onRemove: (key: string) => void
}) {
  return (
    <View
      style={{
        marginBottom: 16,
        padding: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
        backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.5),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <Text variant="muted" style={{ paddingBottom: 8 }}>
        New photos ({assets.length})
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {assets.map((asset) => {
          const key = assetKey(asset)
          return (
            <StagedPhotoTile
              key={key}
              asset={asset}
              isPrimary={key === primaryAssetKey}
              onSelectPrimary={() => onSelectPrimary(key)}
              onRemove={() => onRemove(key)}
            />
          )
        })}
        {canAddMore && <AddPhotoTile onPress={onAddMore} />}
      </View>
    </View>
  )
}

function PhotoActionBar({
  isStaging,
  selectionCount,
  atLimit,
  onPickLibrary,
  onPickCamera,
  onConfirm,
  onCancel,
}: {
  isStaging: boolean
  selectionCount: number
  atLimit: boolean
  onPickLibrary: () => void
  onPickCamera: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  if (isStaging) {
    return (
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button shape="rounded" style={{ flex: 1 }} variant="secondary" onPress={onCancel}>
          <Text>Cancel</Text>
        </Button>
        <Button shape="rounded" style={{ flex: 1 }} onPress={onConfirm}>
          <Check size={16} color={Colors.$iconGeneral} />
          <Text>Confirm ({selectionCount})</Text>
        </Button>
      </View>
    )
  }

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button shape="rounded" style={{ flex: 1 }} disabled={atLimit} onPress={onPickLibrary}>
          <ImageIcon size={16} color={Colors.$iconGeneral} />
          <Text>Library</Text>
        </Button>
        <Button shape="rounded" style={{ flex: 1 }} disabled={atLimit} onPress={onPickCamera}>
          <Camera size={16} color={Colors.$iconGeneral} />
          <Text>Camera</Text>
        </Button>
      </View>
      {atLimit && (
        <Text variant="muted" style={{ textAlign: 'center', paddingTop: 8 }}>
          Maximum of {MAX_PHOTOS_PER_ITEM} photos per item.
        </Text>
      )}
    </>
  )
}

function AddPhotoTile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: TILE_SIZE,
        height: TILE_SIZE,
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.6),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Plus size={24} color={Colors.$iconNeutral} />
    </Pressable>
  )
}

function PendingPhotoTile() {
  return (
    <View
      style={{
        width: TILE_SIZE,
        height: TILE_SIZE,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator />
    </View>
  )
}

/** Shared top-right circular icon button used by both saved and staged tiles. */
function TileBadge({
  onPress,
  disabled,
  icon,
}: {
  onPress: () => void
  disabled?: boolean
  icon: ReactNode
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: Colors.rgba(Colors.$backgroundElevatedLight, 0.85),
        borderRadius: 999,
        padding: 3,
      }}
    >
      {icon}
    </Pressable>
  )
}

function PhotoTile({
  photo,
  isPrimary,
  onSetPrimary,
  onDelete,
  isDeleting,
}: {
  photo: CollectionItemImage
  isPrimary: boolean
  onSetPrimary: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const { data: proxy } = useImageProxy({
    imageId: photo.image_cache_id,
    variant: 'thumb',
    shape: 'card',
  })

  return (
    <View style={{ width: TILE_SIZE, height: TILE_SIZE }}>
      <Pressable
        onPress={onSetPrimary}
        disabled={isDeleting || isPrimary}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 10,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: isPrimary
            ? Colors.$outlinePrimary
            : Colors.rgba(Colors.$outlineNeutral, 0.4),
          opacity: isDeleting ? 0.4 : 1,
        }}
      >
        {proxy?.url && (
          <Image source={{ uri: proxy.url }} style={{ width: '100%', height: '100%' }} />
        )}
      </Pressable>
      {isPrimary && (
        <View style={{ position: 'absolute', top: 4, left: 4 }}>
          <Star size={14} color={Colors.$iconPrimary} fill={Colors.$iconPrimary} />
        </View>
      )}
      <TileBadge
        onPress={onDelete}
        disabled={isDeleting}
        icon={<Trash2 size={12} color={Colors.$iconDanger} />}
      />
    </View>
  )
}

function StagedPhotoTile({
  asset,
  isPrimary,
  onSelectPrimary,
  onRemove,
}: {
  asset: StagedAsset
  isPrimary: boolean
  onSelectPrimary: () => void
  onRemove: () => void
}) {
  return (
    <View style={{ width: TILE_SIZE, height: TILE_SIZE }}>
      <Pressable
        onPress={onSelectPrimary}
        disabled={isPrimary}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 10,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: isPrimary
            ? Colors.$outlinePrimary
            : Colors.rgba(Colors.$outlineNeutral, 0.4),
        }}
      >
        <Image source={{ uri: asset.uri }} style={{ width: '100%', height: '100%' }} />
      </Pressable>
      {isPrimary && (
        <View style={{ position: 'absolute', top: 4, left: 4 }}>
          <Star size={14} color={Colors.$iconPrimary} fill={Colors.$iconPrimary} />
        </View>
      )}
      <TileBadge onPress={onRemove} icon={<X size={12} color={Colors.$iconDanger} />} />
    </View>
  )
}
