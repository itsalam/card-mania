import React from 'react'
import { Text, View } from 'react-native'
import { FetchingDot, LoadingState } from './LoadingState'

type PendingStateProps = {
  width: number
  height: number
  yKeys: string[]
}

export const PendingState = ({ width, height, yKeys }: PendingStateProps) => {
  return (
    <View style={{ width, height, position: 'relative', justifyContent: 'center' }}>
      <LoadingState width={width} height={height} yKeys={yKeys} />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          paddingBottom: 8,
        }}
        pointerEvents="none"
      >
        <View
          style={{
            backgroundColor: 'rgba(0,0,0,0.45)',
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 6,
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
            Fetching price history…
          </Text>
        </View>
      </View>
    </View>
  )
}
