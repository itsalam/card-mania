import React from 'react'
import { View } from 'react-native'
import { FetchingBadge } from './FetchingBadge'
import { LoadingState } from './LoadingState'

type PendingStateProps = {
  width: number
  height: number
  yKeys: string[]
}

export const PendingState = ({ width, height, yKeys }: PendingStateProps) => {
  return (
    <View style={{ width, height, position: 'relative', justifyContent: 'center' }}>
      <LoadingState width={width} height={height} yKeys={yKeys} />
      <FetchingBadge />
    </View>
  )
}
