import React from 'react'
import { Text, View } from 'react-native'
import { FetchingDot } from './LoadingState'

export const FetchingBadge = () => {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 20,
        alignItems: 'flex-end',
        paddingBottom: 8,
      }}
      pointerEvents="none"
    >
      <View
        style={{
          backgroundColor: 'rgba(0,0,0,0.45)',
          borderRadius: 20,
          paddingHorizontal: 10,
          paddingVertical: 4,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <FetchingDot />
        <Text
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontSize: 12,
            fontFamily: 'SpaceMono',
          }}
        >
          Fetching..
        </Text>
      </View>
    </View>
  )
}
