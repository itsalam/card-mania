import { usePriceChartingDataBatch } from '@/client/chart-data'
import { TCard } from '@/constants/types'
import { useIsFocused } from '@react-navigation/native'
import { Href, router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions } from 'react-native'
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

export const useSelectedGrades = (card?: Partial<TCard>, preSelectedGrades?: string[]) => {
  const [selectedGrades, setSelectedGrades] = useState<string[]>(preSelectedGrades || [])
  const { data: priceChartingData, ...priceFetchResults } = usePriceChartingDataBatch({
    card,
    grades: selectedGrades,
  })

  return {
    selectedGrades,
    setSelectedGrades,
    priceChartingData,
    priceFetchResults,
  }
}

export type Coordinates = { x: number; y: number; width: number; height: number }

type TransitionOpts = {
  fallbackHref?: Href
  duration?: number
  onClose?: () => void
  onOpen?: () => void
}

export const useTransitionAnimation = (animateFrom: Coordinates, opts?: TransitionOpts) => {
  const { width: W } = Dimensions.get('window')
  const { cardStyle, scrimStyle, close } = useAnimateFromPosition(
    animateFrom,
    { x: 0, y: 0, width: W, height: W / (5 / 7) },
    opts
  )
  return { cardStyle, scrimStyle, close }
}

function safeBack(fallback = '/' as Href) {
  if (router.canGoBack()) {
    router.back()
  } else {
    router.replace(fallback)
  }
}

function useSafeOnClose(onClose?: () => void, fallback?: Href) {
  const closing = useRef(false)
  return useCallback(() => {
    if (closing.current) return // prevent double-pop / double-call
    closing.current = true
    try {
      onClose?.() // your custom close logic
    } catch (e) {
      console.error('onClose threw:', e)
    } finally {
      safeBack(fallback) // or router.dismiss() if this is a modal
      // if you need to re-open later, you can reset closing.current = false somewhere appropriate
    }
  }, [onClose, fallback])
}

export const useAnimateFromPosition = (
  from: Coordinates,
  to: Coordinates,
  opts?: { duration?: number; onClose?: () => void; onOpen?: () => void; fallbackHref?: Href }
) => {
  const { duration = 350, onClose, onOpen, fallbackHref } = opts || {}
  // shared values
  const animation = useSharedValue({ ...from, progress: 0 })
  const scrim = useSharedValue(0)
  const isFocused = useIsFocused()

  const easeOutEmphasized = Easing.bezier(0.05, 0.7, 0.1, 1)
  const easeInEmphasized = Easing.bezier(0.3, 0, 0.8, 0.15)

  const ZOOM_IN_DELAY = 0 // ms before main anim starts
  const ZOOM_BACK_DELAY = 50 // ms after main anim ends
  const SCRIM_IN_LEAD = duration / 2 // ms before main anim starts
  const SCRIM_OUT_LAG = 0 // ms after main anim ends

  const D_IN = duration + 40
  const D_OUT = duration
  const SCRIM_IN_DUR = Math.round(D_IN * 1.33)
  const SCRIM_OUT_DUR = Math.round(D_OUT * 0.55)

  const closeSafely = useSafeOnClose(onClose, fallbackHref)

  // const { width: W, height: H } = Dimensions.get("window");

  const playOpen = () => {
    // cancel any ongoing to avoid cross-fades stacking
    cancelAnimation(animation)
    cancelAnimation(scrim)

    // scrim starts a bit BEFORE
    scrim.value = withDelay(
      Math.max(0, SCRIM_IN_LEAD - 40), // tiny pre-roll
      withTiming(1, {
        duration: SCRIM_IN_DUR,
        easing: easeOutEmphasized,
      })
    )

    // main card expands
    animation.value = withDelay(
      ZOOM_IN_DELAY,
      withTiming(
        { ...to, progress: 1 },
        {
          duration: Math.round(D_IN * 0.65),
          easing: easeOutEmphasized,
        },
        (finished) => {
          'worklet'
          if (!isFocused) {
            scheduleOnRN(requestAnimationFrame, () => onOpen?.())
            return
          }
          onOpen && scheduleOnRN(onOpen)
        }
      )
    )
  }

  const playClose = () => {
    closeSafely()
  }

  useEffect(() => {
    playOpen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cardStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: animation.value.x,
    top: animation.value.y,
    width: animation.value.width,
    height: animation.value.height,
    overflow: 'hidden',
  }))

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrim.value, // decoupled from progress so it can lead/lag
  }))

  return { animation, cardStyle, scrimStyle, close: playClose }
}
