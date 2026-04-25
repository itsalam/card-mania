import React, { useEffect, useState } from 'react'
import { SharedValue, useAnimatedReaction, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

export const ChartPressContext = React.createContext<{
  sharedX: SharedValue<number>
  sharedXValue: SharedValue<number>
  sharedActive: SharedValue<boolean>
  latestX: SharedValue<number>
  latestXValue: SharedValue<number>
  setLatest: (x: number, xv: number) => void
} | null>(null)

export const ChartPressProvider = ({ children }: { children: React.ReactNode }) => {
  const sharedX = useSharedValue(0)
  const sharedXValue = useSharedValue(0)
  const sharedActive = useSharedValue(false)
  const latestX = useSharedValue(0)
  const latestXValue = useSharedValue(0)
  const setLatest = React.useCallback(
    (x: number, xv: number) => {
      latestX.set(x)
      latestXValue.set(xv)
    },
    [latestX, latestXValue]
  )

  const [activeJs, setActiveJs] = useState(false)

  useAnimatedReaction(
    () => sharedActive.value,
    (v) => {
      'worklet'
      scheduleOnRN(setActiveJs, v)
    },
    [sharedActive]
  )

  useEffect(() => {
    if (activeJs) return
    const t = setTimeout(() => {
      sharedX.set(latestX.value)
      sharedXValue.set(latestXValue.value)
      sharedActive.set(true)
    }, 80)
    return () => clearTimeout(t)
  }, [activeJs, sharedX, sharedXValue, sharedActive, latestX, latestXValue])

  return (
    <ChartPressContext.Provider
      value={{ sharedX, sharedXValue, sharedActive, latestX, latestXValue, setLatest }}
    >
      {children}
    </ChartPressContext.Provider>
  )
}

export const useSharedPress = () => {
  const context = React.useContext(ChartPressContext)
  if (!context) {
    throw new Error('useChartPress must be used within a ChartPressProvider')
  }
  return context
}
