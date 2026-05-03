import { Text } from '@/components/ui/text/base-text'
import React from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export function PostsPage() {
  return (
    <View style={{ padding: 24, alignItems: 'center' }}>
      <Text variant="muted" style={{ color: Colors.$textNeutralLight }}>
        No posts yet
      </Text>
    </View>
  )
}
