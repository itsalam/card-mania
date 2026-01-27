import { CollectionRow } from '@/client/collections/types'
import { Text } from '@/components/ui/text'
import { LucideIcon } from 'lucide-react-native'
import React, { ReactNode } from 'react'
import { View } from 'react-native'
import { Colors, Spacings, TouchableOpacity } from 'react-native-ui-lib'
import { CollectionsAvatar } from './avatar'

export const CollectionListView = ({
  collection,
  icon,
  onPress,
  rightElement,
}: {
  collection: CollectionRow
  icon?: LucideIcon
  onPress?: () => void
  rightElement?: ReactNode
}) => {
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
      </View>
    </TouchableOpacity>
  )
}
