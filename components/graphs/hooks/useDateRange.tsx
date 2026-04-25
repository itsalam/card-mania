import { Skeleton } from '@/components/ui/skeleton'
import React, { ReactNode, useState } from 'react'
import { View } from 'react-native'
import { Colors, SegmentedControl } from 'react-native-ui-lib'
import { TIME_PERIODS } from '../constants'

export const DateRangeContext = React.createContext<{
  timePeriod: string
  setTimePeriod: (s: string) => void
} | null>(null)

export const useTimeRange = () => {
  const context = React.useContext(DateRangeContext)
  if (!context) {
    throw new Error('useTimeRange must be used within a DateRangeProvider')
  }
  return context
}

export function DateRangeProvider({
  children,
  renderChildren,
  isLoading,
}: {
  children?: ReactNode
  renderChildren?: (control: ReactNode) => ReactNode
  isLoading?: boolean
}) {
  const [timePeriod, setTimePeriod] = useState(TIME_PERIODS[0])

  const SegmentControlComponent = !isLoading ? (
    <View
      style={{
        paddingHorizontal: 12,
      }}
    >
      <SegmentedControl
        activeColor={Colors.$iconPrimary}
        segments={TIME_PERIODS.map((period) => ({ label: period }))}
        onChangeIndex={(index) => setTimePeriod(TIME_PERIODS[index])}
        backgroundColor={Colors.$backgroundElevated}
        outlineColor={Colors.$outlineNeutral}
        activeBackgroundColor={Colors.$backgroundElevatedLight}
        style={{
          borderColor: Colors.$backgroundElevatedLight,
        }}
      />
    </View>
  ) : (
    <View className="w-full px-12 py-4">
      <Skeleton style={{ width: '100%', height: 34, borderRadius: 1000 }} />
    </View>
  )

  return (
    <DateRangeContext.Provider value={{ timePeriod, setTimePeriod }}>
      {renderChildren ? (
        renderChildren(SegmentControlComponent)
      ) : (
        <View>
          {children}
          {SegmentControlComponent}
        </View>
      )}
    </DateRangeContext.Provider>
  )
}
