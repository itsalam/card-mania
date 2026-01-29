import { ToggleBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/spinner'
import { Text } from '@/components/ui/text'
import { VISIBILITY_OPTIONS } from '@/features/tcg-card-views/DetailCardView/ui'
import { UserAvatar } from '@/features/users/components/UserAvatars'
import { DUMMY_USERS } from '@/features/users/helpers'
import { useRouter } from 'expo-router'
import {
  BanknoteX,
  LayoutList,
  LucideIcon,
  Pencil,
  Plus,
  SeparatorHorizontal,
  Store,
} from 'lucide-react-native'
import { MotiView } from 'moti'
import { useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { isDefaultCollection } from '../helpers'
import { useGetCollection, useGetCollectionCountInfo } from '../hooks'
import { DefaultPageTypes, useCollectionsPageStore } from '../provider'

type Option = {
  label: string
  icon: LucideIcon
  onClick?: () => void
  iconColor?: string
}

const SortOptions = ['name', 'added_on', 'custom', 'set_name']

const DisplayOptions = ['compact', 'list', 'grid']

export const CollectionInfo = () => {
  const { currentPage, setCurrentPage, preferenceState, showEditView, setShowEditView } =
    useCollectionsPageStore()

  const [showSortModal, setShowSortModal] = useState(false)
  const [showDisplayModal, setShowDisplayModal] = useState(false)

  const collectionId =
    preferenceState.preferences.defaultIds[currentPage as DefaultPageTypes] ?? currentPage
  const { data: collection } = useGetCollection({ collectionId })
  const { data: count } = useGetCollectionCountInfo({ collectionId })

  const visiblityInfo = VISIBILITY_OPTIONS.find((v) => v.key === collection?.visibility)
  const VisibilityIcon = visiblityInfo?.icon
  const publicAttr = (
    <>
      {VisibilityIcon ? <VisibilityIcon color={Colors.$textDefault} size={14} /> : null}
      <Text
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

  const options: Record<string, Option> = {
    add: {
      label: 'Add',
      icon: Plus,
      onClick() {
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
        setShowEditView(true)
      },
    },
    sort: {
      label: 'Sort',
      icon: SeparatorHorizontal,
      onClick() {
        setShowSortModal(true)
      },
      //TODO
    },
    display: {
      label: 'Display',
      icon: LayoutList,
      //TODO

      onClick() {
        setShowDisplayModal(true)
      },
    },
  }

  if (showEditView) {
    return null
  }

  //@ts-ignore
  const tabs = [...Object.entries(options)].filter(
    (option) => !collection || !isDefaultCollection(collection) || option[0] !== 'edit'
  )

  return (
    <>
      <MotiView
        // entering={FadeInRight}
        // exiting={FadeOutLeft}
        key={collection ? `loaded-${collection.id}` : collectionId}
        from={{ flex: 0 }}
        animate={{ flex: 1 }}
        style={{
          padding: 16,
          paddingHorizontal: 20,
          display: 'flex',
          gap: 4,
        }}
      >
        {collection?.description ? (
          <View
            style={{
              paddingBottom: 8,
            }}
          >
            <Text variant={'small'}>{collection.description}</Text>
          </View>
        ) : (
          <Spinner />
        )}

        <View style={{ display: 'flex', gap: 8 }}>
          <View style={{ display: 'flex', gap: 4 }}>
            <UserAvatar user={DUMMY_USERS[0]} size="sm" />

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
                <Text style={{ color: Colors.$textNeutral, paddingHorizontal: 3 }}>•</Text>
              )}
            />
          </View>
          <FlatList
            data={tabs}
            horizontal
            contentContainerStyle={{
              display: 'flex',
              flexDirection: 'row',
              gap: 8,
              // overflow: 'visible',
            }}
            style={{ overflow: 'visible' }}
            renderItem={({ item }) => {
              const Icon = item[1].icon
              return (
                <TouchableOpacity onPress={() => item[1].onClick?.()}>
                  <ToggleBadge
                    label={item[1].label}
                    checked
                    leftElement={
                      <Icon
                        color={Colors.$iconDefaultLight}
                        size={18}
                        strokeWidth={2.5}
                        style={{ marginLeft: 4 }}
                      />
                    }
                  />
                </TouchableOpacity>
              )
            }}
          />
        </View>
        <Modal visible={showSortModal} onDismiss={() => setShowSortModal(false)}>
          {SortOptions.map((option) => (
            <Button>{option}</Button>
          ))}
        </Modal>

        <Modal visible={showDisplayModal} onDismiss={() => setShowDisplayModal(false)}>
          {DisplayOptions.map((option) => (
            <Button>{option}</Button>
          ))}
        </Modal>
      </MotiView>
    </>
  )
}
