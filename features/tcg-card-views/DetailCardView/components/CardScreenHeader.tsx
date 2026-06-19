import { Text } from '@/components/ui/text/base-text'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export const CardScreenHeader = (props: { title: string; backgroundColor?: string }) => {
  const { title, backgroundColor = Colors.rgba(Colors.$textPrimary, 0.8) } = props
  const bgOpaque: string = Colors.$backgroundDefault ?? '#000'
  const bgTransparent: string = Colors.rgba(bgOpaque, 0) ?? 'transparent'
  return (
    <View style={{ width: '100%', paddingTop: 14 }}>
      {/* Gradient cover: opaque at top (hides content behind sticky header),
          fades to transparent below so content beyond the header stays visible */}
      <LinearGradient
        colors={[bgOpaque, bgTransparent]}
        start={{ x: 0, y: 0.4 }}
        end={{ x: 0, y: 0.7 }}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: -40 }}
      />

      <View className="w-full py-1 flex flex-row items-center justify-center gap-3">
        <View style={{ backgroundColor, height: 1.5, width: 32 }} />
        <Text
          style={{ color: backgroundColor, lineHeight: 18 }}
          variant="large"
          className="font-spaceMono"
        >
          {title}
        </Text>
        <View style={{ backgroundColor, height: 2, flex: 1, marginLeft: 6 }} />
      </View>
    </View>
  )
}
