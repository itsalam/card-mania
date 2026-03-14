import { Text } from '@/components/ui/text/base-text'
import React from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export const CardScreenHeader = (props: { title: string; backgroundColor?: string }) => {
  const { title, backgroundColor = Colors.rgba(Colors.$textPrimary, 0.8) } = props
  return (
    <View className="w-full py-1 flex flex-row items-center justify-center gap-3">
      <View style={{ backgroundColor, height: 1.5, width: 32 }} />
      <Text style={{ color: backgroundColor }} variant="large" className="font-spaceMono">
        {title}
      </Text>
      <View style={{ backgroundColor, height: 2, flex: 1, marginLeft: 6 }} />
    </View>
  )
}
