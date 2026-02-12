import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { Image } from 'expo-image'
import { FolderHeart, LucideIcon } from 'lucide-react-native'
import React from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export const CollectionsAvatar = ({
  icon: Icon,
  iconImageSrc,
}: {
  icon?: LucideIcon
  iconImageSrc?: string
}) => {
  const scheme = useEffectiveColorScheme()
  return (
    <View
      key={scheme}
      className="h-14 w-14 rounded-xl flex items-center justify-center"
      style={{
        borderColor: Colors.$outlinePrimary,
        borderWidth: 2,
        backgroundColor: Colors.$backgroundNeutral,
      }}
    >
      {Icon ? (
        <Icon height={24} width={24} strokeWidth={2} stroke={Colors.$textPrimary} />
      ) : iconImageSrc ? (
        <Image source={{ uri: iconImageSrc }} style={{ height: 32, width: 32 }} />
      ) : (
        <FolderHeart height={20} width={20} strokeWidth={1.5} stroke={Colors.$textPrimary} />
      )}
    </View>
  )
}
