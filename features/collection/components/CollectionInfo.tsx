import { VISIBILITY_OPTIONS } from '@/components/tcg-card/views/DetailCardView/ui'
import { ToggleBadge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { UserAvatar } from '@/features/users/components/UserAvatars'
import { DUMMY_USERS } from '@/features/users/helpers'
import { useUserStore } from '@/lib/store/useUserStore'
import { useRouter } from 'expo-router'
import { LayoutList, LucideIcon, Pencil, Plus, SeparatorHorizontal } from 'lucide-react-native'
import { MotiView } from 'moti'
import { FlatList, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useGetCollection, useGetCollectionCountInfo } from '../hooks'
import { DefaultPageTypes, useCollectionsPageStore } from '../provider'

type Option = {
  label: string
  icon: LucideIcon
  onClick?: () => void
  iconColor?: string
}

export const CollectionInfo = () => {
  const { currentPage, preferenceState } = useCollectionsPageStore()
  const { user } = useUserStore()

  const collectionId =
    preferenceState.preferences.defaultIds[currentPage as DefaultPageTypes] ?? currentPage
  const { data: collection } = useGetCollection({ collectionId })
  const { data: count } = useGetCollectionCountInfo({ collectionId })

  if (!collection) {
    return null
  }

  const isPublic = collection.visibility === 'public'
  const isUsers = collection.user_id === user?.id
  const visiblityInfo = VISIBILITY_OPTIONS.find((v) => v.key === collection.visibility)
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
  const attributes = {
    items: (
      <Text
        style={{
          color: Colors.$textNeutral,
        }}
      >
        {`${count} items`}
      </Text>
    ),
    visibility: publicAttr,
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
    },
    sort: {
      label: 'Sort',
      icon: SeparatorHorizontal,
    },
    display: {
      label: 'Display',
      icon: LayoutList,
    },
  }

  return (
    <MotiView
      key={collectionId}
      from={{ flex: 0 }}
      animate={{ flex: 1 }}
      style={{
        padding: 12,
        paddingHorizontal: 20,
        display: 'flex',
        gap: 4,
      }}
    >
      <View
        style={{
          paddingBottom: 4,
        }}
      >
        <Text variant={'lead'}>{collection.description}</Text>
      </View>

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
          data={Object.entries(options)}
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
                  leftElement={<Icon color={Colors.$icon} size={20} />}
                />
              </TouchableOpacity>
            )
          }}
        />
      </View>
    </MotiView>
  )
}
