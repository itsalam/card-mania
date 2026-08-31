import { ToggleBadge } from '@/components/ui/badge'
import { SkeletonText } from '@/components/ui/text'
import { Text } from '@/components/ui/text/base-text'
import { OnboardingTarget, useOnboardingStore } from '@/features/onboarding'
import { VISIBILITY_OPTIONS } from '@/features/tcg-card-views/DetailCardView/components/ui'
import { useUserStore } from '@/lib/store/useUserStore'
import { useRouter } from 'expo-router'
import {
  BanknoteX,
  FolderCheck,
  FolderPlus,
  LucideIcon,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Store,
  Trash,
} from 'lucide-react-native'
import { MotiView } from 'moti'
import { useState } from 'react'
import { FlatList, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { isDefaultCollection } from '../helpers'
import {
  useGetCollection,
  useGetCollectionCountInfo,
  usePinnedCollections,
  useRemovePinnedCollection,
  useRemoveSavedCollection,
  useSavedCollections,
  useTouchPinnedCollection,
  useTouchSavedCollection,
} from '../hooks'
import { DefaultPageTypes, useCollectionsPageStore } from '../provider'
import { DeleteModal } from './DeleteModal'

type Option = {
  label: string
  icon: LucideIcon
  onClick?: () => void
  iconColor?: string
  backgroundColor?: string
}

/**
 * Renders collection name/description/attributes, and — when `showActions` is
 * true — the Add/Edit/Delete action row. With an explicit `collectionId` this
 * renders standalone (no `CollectionsViewProvider` required), so it can be
 * embedded read-only outside the Collections tab (e.g. the Storefront view).
 * Without one, it falls back to deriving the collection from the Collections
 * page store (`CollectionInfoFromStore` below) — the original behavior.
 */
export const CollectionInfo = ({
  collectionId,
  showActions,
}: {
  collectionId?: string
  showActions?: boolean
} = {}) => {
  if (collectionId) {
    return <CollectionInfoContent collectionId={collectionId} showActions={showActions ?? false} />
  }
  return <CollectionInfoFromStore showActions={showActions ?? true} />
}

function CollectionInfoFromStore({ showActions }: { showActions: boolean }) {
  const { currentPage, preferenceState, showEditView, setShowEditView } = useCollectionsPageStore()

  if (showEditView) {
    return null
  }

  const collectionId =
    preferenceState.preferences.defaultIds[currentPage as DefaultPageTypes] ?? currentPage

  return (
    <CollectionInfoContent
      collectionId={collectionId}
      showActions={showActions}
      onEdit={() => setShowEditView(true)}
    />
  )
}

function CollectionInfoContent({
  collectionId,
  showActions,
  onEdit,
}: {
  collectionId?: string
  showActions: boolean
  onEdit?: () => void
}) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const authUserId = useUserStore((s) => s.user?.id)
  const { data: collection } = useGetCollection({ collectionId })
  const { data: count } = useGetCollectionCountInfo({ collectionId })
  const isOwned = collection ? collection.user_id === authUserId : undefined

  const visiblityInfo = VISIBILITY_OPTIONS.find((v) => v.key === collection?.visibility)
  const VisibilityIcon = visiblityInfo?.icon
  const publicAttr = (
    <>
      {VisibilityIcon ? <VisibilityIcon color={Colors.$textDefault} size={14} /> : null}
      <Text
        variant={'stats'}
        style={{
          color: Colors.$textNeutral,
        }}
      >
        {visiblityInfo?.label}
      </Text>
    </>
  )

  const storeFrontAttr = (
    <>
      {collection?.is_storefront ? <Store color={Colors.$textDefault} size={14} /> : null}
      <Text
        variant={'stats'}
        style={{
          color: Colors.$textNeutral,
        }}
      >
        {'Storefront'}
      </Text>
    </>
  )

  const hideSoldAttr = (
    <>
      {collection?.hide_sold_items ? <BanknoteX color={Colors.$textDefault} size={14} /> : null}
      <Text
        variant={'stats'}
        style={{
          color: Colors.$textNeutral,
        }}
      >
        {'Sold items hidden'}
      </Text>
    </>
  )

  const attributes = {
    items: (
      <Text
        variant={'stats'}
        style={{
          color: Colors.$textNeutral,
        }}
      >
        {`${count ?? '0'} items`}
      </Text>
    ),
    visibility: publicAttr,
    ...(collection?.is_storefront ? { storefront: storeFrontAttr } : {}),
    ...(collection?.hide_sold_items ? { hidden_items: hideSoldAttr } : {}),
  }

  const router = useRouter()

  const options: Record<string, Option> = showActions
    ? {
        add: {
          label: 'Add',
          icon: Plus,
          onClick() {
            useOnboardingStore.getState().advanceIfCurrentStep('collection-add-card')
            router.push({
              pathname: '/collection/add-card',
              params: { collectionId },
            })
          },
        },
        edit: {
          label: 'Edit',
          icon: Pencil,
          onClick() {
            onEdit?.()
          },
        },
        delete: {
          label: 'Delete',
          icon: Trash,
          onClick() {
            setShowDeleteModal(true)
          },
          backgroundColor: Colors.$backgroundDangerLight,
        },
      }
    : {}

  //@ts-ignore
  const visibleOptions = [...Object.entries(options)].filter(
    (option) => !collection || !isDefaultCollection(collection) || option[0] !== 'edit'
  )

  return (
    <>
      <MotiView
        key={collection ? `loaded-${collection.id}` : collectionId}
        from={{ flex: 0 }}
        animate={{ flex: 1 }}
        style={{
          paddingBottom: 12,
          paddingHorizontal: 16,
          paddingTop: 12,
          display: 'flex',
          gap: 4,
        }}
      >
        <SkeletonText loading={!collection?.name} variant={'h3'} placeholderTextLength={24}>
          {collection?.name}
        </SkeletonText>
        <SkeletonText
          loading={!collection?.description}
          variant={'small'}
          placeholderTextLength={104}
          numberOfLines={2}
        >
          {collection?.description}
        </SkeletonText>

        <View style={{ display: 'flex', gap: 12 }}>
          <FlatList
            horizontal
            data={Object.entries(attributes)}
            bounces={false}
            renderItem={({ item }) => (
              <View
                key={item[0]}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                {item[1]}
              </View>
            )}
            ItemSeparatorComponent={() => (
              <Text variant={'stats'} style={{ color: Colors.$textNeutral, paddingHorizontal: 3 }}>
                •
              </Text>
            )}
          />

          {showActions ? (
            <FlatList
              data={visibleOptions}
              horizontal
              contentContainerStyle={{
                display: 'flex',
                flexDirection: 'row',
                gap: 8,
              }}
              style={{ overflow: 'visible' }}
              renderItem={({ item }) => {
                const Icon = item[1].icon
                const badge = (
                  <ToggleBadge
                    onPress={() => {
                      item[1].onClick?.()
                    }}
                    label={item[1].label}
                    checked
                    {...(item[1].backgroundColor
                      ? { backgroundColor: item[1].backgroundColor }
                      : {})}
                    icon={Icon}
                  />
                )
                return item[0] === 'add' ? (
                  <OnboardingTarget id="collection-add-card">{badge}</OnboardingTarget>
                ) : (
                  badge
                )
              }}
            />
          ) : (
            collection &&
            isOwned === false && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AddToCollectionToggle collectionId={collection.id} />
                <PinToggle collectionId={collection.id} />
              </View>
            )
          )}
        </View>
        {showActions && (
          <DeleteModal
            showDeleteModal={showDeleteModal}
            setShowDeleteModal={setShowDeleteModal}
            collectionId={collectionId}
          />
        )}
      </MotiView>
    </>
  )
}

/**
 * Adds a non-owned collection to the current user's general saved_collections
 * bucket — powers the Collections page's "Shared with me" section. Independent
 * of PinToggle below: adding to this bucket doesn't also pin it, and vice versa.
 */
function AddToCollectionToggle({ collectionId }: { collectionId: string }) {
  const { data: savedCollections } = useSavedCollections()
  const touch = useTouchSavedCollection()
  const remove = useRemoveSavedCollection()
  const isSaved = !!savedCollections?.some((row) => row.collection_id === collectionId)

  return (
    <ToggleBadge
      onPress={() => {
        if (isSaved) {
          remove.mutate(collectionId)
        } else {
          touch.mutate(collectionId)
        }
      }}
      label={isSaved ? 'Added' : 'Add to'}
      checked={isSaved}
      icon={isSaved ? FolderCheck : FolderPlus}
    />
  )
}

/** Pins a non-owned collection into the current user's "Pinned" collection_group. */
function PinToggle({ collectionId }: { collectionId: string }) {
  const { data: pinnedCollections } = usePinnedCollections()
  const touch = useTouchPinnedCollection()
  const remove = useRemovePinnedCollection()
  const isPinned = !!pinnedCollections?.some((row) => row.collection_id === collectionId)

  return (
    <ToggleBadge
      onPress={() => {
        if (isPinned) {
          remove.mutate(collectionId)
        } else {
          touch.mutate(collectionId)
        }
      }}
      label={isPinned ? 'Pinned' : 'Pin'}
      checked={isPinned}
      icon={isPinned ? Pin : PinOff}
    />
  )
}
