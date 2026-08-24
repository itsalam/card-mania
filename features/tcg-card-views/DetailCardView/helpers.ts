import { usePriceChartingDataBatch } from '@/client/chart-data'
import { TCard } from '@/constants/types'
import { useIsFocused } from '@react-navigation/native'
import { Href, router } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dimensions } from 'react-native'
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
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

  // Synthesise today-priced stub points for grades not yet in real history data.
  // Keeps hasValidData true immediately after a grade toggle, preventing LoadingState flash.
  // Replaced seamlessly once real history arrives.
  const optimisticPriceData = useMemo<Record<string, string | number>[] | undefined>(() => {
    if (!card?.grades_prices || !selectedGrades.length) return undefined
    const gradesPrices = card.grades_prices as Record<string, number>
    const gradesWithData = new Set(
      (priceChartingData?.priceData ?? []).flatMap((pt) =>
        Object.keys(pt).filter((k) => k !== 'date' && typeof pt[k] === 'number')
      )
    )
    const missingGrades = selectedGrades.filter(
      (g) => !gradesWithData.has(g) && gradesPrices[g] != null
    )
    if (!missingGrades.length) return undefined
    const point: Record<string, string | number> = { date: Date.now() }
    for (const g of missingGrades) {
      point[g] = gradesPrices[g]
    }
    return Object.keys(point).length > 1 ? [point] : undefined
  }, [card?.grades_prices, selectedGrades, priceChartingData?.priceData])

  return {
    selectedGrades,
    setSelectedGrades,
    priceChartingData,
    optimisticPriceData,
    priceFetchResults,
  }
}

export type Coordinates = {
  x: number
  y: number
  width: number
  height: number
}

type TransitionOpts = {
  fallbackHref?: Href
  duration?: number
  onClose?: () => void
  onOpen?: () => void
  animateTo?: Coordinates
  ready?: boolean
}

export const useTransitionAnimation = (animateFrom: Coordinates, opts: TransitionOpts = {}) => {
  const { width: W } = Dimensions.get('window')
  const { animateTo = { x: 0, y: 0, width: W, height: W / (5 / 7) }, ready, ...otherOps } = opts

  const { animation, cardStyle, scrimStyle, close } = useAnimateFromPosition(
    animateFrom,
    animateTo,
    { ...otherOps, ready }
  )

  const progress = useDerivedValue(() => animation.value.progress)
  return { progress, animation, cardStyle, scrimStyle, close }
}

/**
 * The profile tab's own local route this screen lives under (`app/(tabs)/profile/_layout.tsx`).
 * Used to clean up that stack on close — see the big comment in safeBack below.
 */
const PROFILE_STACK_INDEX = '/profile' as Href

function safeBack(fallback?: Href) {
  // This screen is commonly reached via a cross-navigator push (e.g. a collection list
  // tile pushing into the profile tab's own nested stack for `/profile/[shop-item]`).
  // None of the single-call primitives handle closing it correctly:
  //  - dismissTo/canDismiss are scoped to this screen's *local* stack (the profile tab's
  //    own `[shop-item]` stack) — canDismiss comes back false here (nothing local beneath
  //    this screen), so dismissTo falls through to its own documented fallback — "replace
  //    the current screen with the provided href" — which can't resolve a route living in
  //    a different tab, so nothing visibly happens. Confirmed via logging: canDismiss:
  //    false, canGoBack: true. router.replace(fallback) directly is the same no-op for
  //    the same reason — it's the identical operation dismissTo already fell through to.
  //  - canGoBack/back() DO unwind (canGoBack is true here), but operate on the stack's
  //    push/pop history, not "which tab was active" — tab switches aren't push-based in
  //    React Navigation's bottom-tabs by default, so back() from deep inside the profile
  //    tab's stack falls all the way back to the tab navigator's initial tab (Home), not
  //    the tab the user actually came from. Confirmed by testing: landed on Home instead
  //    of Collection.
  //  - router.navigate(fallback) alone DOES land on the right destination (it's the one
  //    primitive built for "get me to this href, switching navigators/tabs as needed"),
  //    but it doesn't remove [shop-item] from the profile tab's own local stack — that
  //    screen is left mounted-but-blurred underneath. Confirmed via logging (instanceId
  //    tagged on mount): re-opening a card later re-focuses that SAME stale instance
  //    (blurred → focused, no unmount/remount in between) instead of mounting fresh,
  //    carrying over every Reanimated shared value — stuck scroll/collapse position,
  //    stale open/close animation state (back button rendering as if mid-transition).
  //
  // Fix: explicitly replace THIS screen with the profile tab's own index — a same-
  // navigator replace, so (unlike the cross-navigator case above) it actually removes
  // [shop-item] from history — *then* navigate to the real destination, which may be a
  // different tab entirely. Two dispatches, but each is now doing a job the other can't.
  if (fallback) {
    router.replace(PROFILE_STACK_INDEX)
    router.navigate(fallback)
    return
  }
  if (router.canGoBack()) {
    router.back()
  } else {
    router.replace('/')
  }
}

function useSafeOnClose(onClose?: () => void, fallback?: Href) {
  const closing = useRef(false)
  return useCallback(() => {
    if (closing.current) return
    closing.current = true
    try {
      onClose?.() // your custom close logic
    } catch (e) {
      console.error('[DetailCardView] onClose threw:', e)
    } finally {
      try {
        safeBack(fallback) // or router.dismiss() if this is a modal
      } catch (e) {
        // Reset the guard so a failed navigation doesn't permanently disable the
        // button for the rest of this screen's lifetime.
        console.error('[DetailCardView] safeBack threw, resetting close guard', e)
        closing.current = false
      }
      // if you need to re-open later, you can reset closing.current = false somewhere appropriate
    }
  }, [onClose, fallback])
}

export const useAnimateFromPosition = (
  from: Coordinates,
  to: Coordinates,
  opts?: {
    duration?: number
    onClose?: () => void
    onOpen?: () => void
    fallbackHref?: Href
    ready?: boolean
  }
) => {
  const { duration = 1250, onClose, onOpen, fallbackHref, ready = true } = opts || {}
  // shared values
  const animation = useSharedValue({ ...from, progress: 0 })
  const scrim = useSharedValue(0)
  const isFocused = useIsFocused()
  const isFocusedSV = useSharedValue(isFocused)
  useEffect(() => {
    isFocusedSV.value = isFocused
  }, [isFocused])

  useEffect(() => {
    animation.value = { ...from, progress: 0 }
  }, [from])

  const easeOutEmphasized = Easing.bezier(0.2, 1, 0.05, 0.94)
  const easeInEmphasized = Easing.bezier(0.3, 0, 0.8, 0.15)

  const ZOOM_IN_DELAY = 0 // ms before main anim starts
  const SCRIM_IN_LEAD = duration + 100 // ms before main anim starts
  const SCRIM_OUT_LAG = 0 // ms after main anim ends

  const D_IN = duration + 40
  const SCRIM_IN_DUR = Math.round(D_IN * 1.33)

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
          if (!isFocusedSV.value) {
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
    if (!ready) return
    playOpen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const cardStyle = useAnimatedStyle(() => ({
    left: animation.value.x,
    top: animation.value.y,
  }))

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrim.value, // decoupled from progress so it can lead/lag
  }))

  return { animation, cardStyle, scrimStyle, close: playClose }
}
