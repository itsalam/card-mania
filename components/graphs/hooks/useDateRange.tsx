import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text/base-text'
import React, { ReactNode, useState } from 'react'
import { View } from 'react-native'
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
    <View style={{ paddingHorizontal: 12 }}>
      <Tabs value={timePeriod} onValueChange={setTimePeriod}>
        <TabsList>
          {TIME_PERIODS.map((period) => (
            <TabsTrigger key={period} value={period} style={{ paddingHorizontal: 10 }}>
              <Text variant="small" style={{ fontSize: 13, lineHeight: 16 }}>
                {period}
              </Text>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
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
