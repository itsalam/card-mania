import { Text } from '@/components/ui/text'
import { CollectionRow } from '@/lib/store/functions/types'
import { LucideIcon } from 'lucide-react-native'
import React, { ReactNode } from 'react'
import { View } from 'react-native'
import { Colors, Spacings, TouchableOpacity } from 'react-native-ui-lib'
import { Skeleton } from '../ui/skeleton'
import { CollectionsAvatar } from './avatar'

export const CollectionListView = ({
  collection,
  icon,
  onPress,
  rightElement,
  isLoading,
}: {
  collection: CollectionRow
  icon?: LucideIcon
  onPress?: () => void
  rightElement?: ReactNode
  isLoading?: boolean
}) => {
  const loadingView = (
    <>
      <Skeleton className="h-14 w-14 rounded-xl flex items-center justify-center" />
      <View
        key={`loading-${collection.id}`}
        className="shrink-1 flex-1"
        style={{
          gap: 8,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Skeleton style={{ height: 20, width: 104 }} />
        <Skeleton style={{ height: 12, width: 240 }} />
      </View>
    </>
  )
  return (
    <TouchableOpacity onPress={onPress}>
      <View
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacings.s4,
          paddingRight: Spacings.s2,
          paddingLeft: Spacings.s1,
        }}
        key={collection.id}
      >
        {isLoading ? (
          loadingView
        ) : (
          <>
            <CollectionsAvatar icon={icon} iconImageSrc={collection.cover_image_url ?? undefined} />
            <View key={collection.id} className="shrink-1 flex-1">
              <Text variant={'h4'}>{collection.name}</Text>
              <Text
                style={{
                  color: Colors.$textNeutralHeavy,
                  flexWrap: 'wrap',
                  width: '100%',
                }}
              >
                {collection.description}
              </Text>
            </View>
            {/* <RadioButton selected={collection.has_item} /> */}
            {rightElement}
          </>
        )}
      </View>
    </TouchableOpacity>
  )
}
