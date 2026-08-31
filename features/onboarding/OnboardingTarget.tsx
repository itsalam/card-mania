import { useIsFocused } from '@react-navigation/native'
import { Portal } from '@rn-primitives/portal'
import React, { useEffect, useRef, useState } from 'react'
import { StyleProp, View, ViewStyle, useWindowDimensions } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
import { TOURS } from './steps'
import { OnboardingStepId, TargetMeasurement } from './types'
import { useOnboardingStore } from './OnboardingProvider'

type Props = {
  id: OnboardingStepId
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

/** Pulsing ring shown on a target whose step is the tour's current one but the full spotlight
 *  overlay isn't showing (dropped/dismissed) — a lightweight, persistent "this has a tutorial
 *  waiting" cue, independent of overlay visibility. Disappears the instant the target's own
 *  press handler calls advanceIfCurrentStep, since that flips the step forward (or reopens the
 *  overlay, which also stops rendering this — see the !active condition below).
 *
 *  Rendered through a Portal into the root PortalHost (app/_layout.tsx) rather than as a normal
 *  in-flow sibling of the target — targets often sit inside an `overflow: hidden` ancestor (the
 *  rounded collection card in CollectionPageLayout, the `overflow-hidden` pinned-tabs row in
 *  TabList.tsx), which was clipping the ring's -3px outward bleed. Positioned from live window
 *  coordinates, re-measured every frame while visible rather than once, so it stays glued to its
 *  target through any ancestor's scroll — there's no single scroll event to subscribe to here
 *  since a target could be nested inside any number of unrelated ScrollViews.
 *
 *  Gated on useIsFocused(): Expo Router/React Navigation keep screens mounted when you navigate
 *  away (stack screens pushed on top, other tab screens) rather than unmounting them, so the
 *  target — and this ring's measure loop — would otherwise keep running in the background.
 *  Because the ring paints through a root-level Portal, escaping the target's own screen
 *  hierarchy, an unfocused target's ring would render on top of whatever screen the user
 *  actually navigated to instead of just being (harmlessly) hidden behind it.
 */
function PendingHighlightRing({
  id,
  targetRef,
  yOffset,
}: {
  id: OnboardingStepId
  targetRef: React.RefObject<View | null>
  /** See OnboardingStep.modalPresentation's comment in types.ts. */
  yOffset: number
}) {
  const isFocused = useIsFocused()
  const [rect, setRect] = useState<TargetMeasurement | null>(null)
  const pulse = useSharedValue(0)

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })),
      -1,
      true
    )
  }, [pulse])

  useEffect(() => {
    if (!isFocused) return

    let frameId: number
    let cancelled = false

    const measure = () => {
      if (cancelled) return
      const node = targetRef.current as any
      node?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
        if (cancelled) return
        if (width > 0 && height > 0) setRect({ x, y: y + yOffset, width, height })
      })
      frameId = requestAnimationFrame(measure)
    }

    frameId = requestAnimationFrame(measure)
    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
    }
  }, [targetRef, isFocused, yOffset])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.35,
  }))

  if (!isFocused || !rect) return null

  return (
    <Portal name={`onboarding-pending-highlight-${id}`}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: rect.x - 3,
            top: rect.y - 3,
            width: rect.width + 6,
            height: rect.height + 6,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: Colors.$textPrimary,
          },
          animatedStyle,
        ]}
      />
    </Portal>
  )
}

export function OnboardingTarget({ id, children, style }: Props) {
  const ref = useRef<View>(null)
  const { registerTarget, unregisterTarget, setMeasurement, active, tourId, currentIndex } =
    useOnboardingStore()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const currentStep = TOURS[tourId][currentIndex]
  const isPendingStep = currentStep?.id === id
  // Only while the overlay itself isn't showing — when it is, the overlay's own spotlight ring
  // already highlights this exact target, and drawing both would just double up.
  const showPendingHighlight = isPendingStep && !active
  // See OnboardingStep.modalPresentation's comment in types.ts — confirmed via a live device
  // test that measureInWindow inside a presentation:'modal' screen under-reports Y by roughly
  // the safe-area top inset relative to where the root-level overlay/portal actually renders.
  const yOffset = currentStep?.modalPresentation ? insets.top : 0

  useEffect(() => {
    registerTarget(id, ref)
    return () => unregisterTarget(id)
  }, [id])

  useEffect(() => {
    if (!active) return
    if (currentStep?.id !== id) return

    // Continuous re-measurement, not a bounded retry-until-first-success — this target's screen
    // may still be settling (entrance transition, async content loading in, a header whose
    // height change pushes everything below it down) after the first successful non-zero read,
    // and a one-shot measurement frozen at that moment goes stale the instant layout shifts
    // again, leaving the spotlight/ring drawn above or beside the real (now-moved) target.
    // Mirrors PendingHighlightRing's own continuous rAF loop, for the same reason.
    let frameId: number
    let cancelled = false

    const measure = () => {
      if (cancelled) return
      const node = ref.current as any
      node?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
        if (cancelled) return
        if (width > 0 && height > 0) setMeasurement(id, { x, y: y + yOffset, width, height })
      })
      frameId = requestAnimationFrame(measure)
    }

    frameId = requestAnimationFrame(measure)
    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
    }
  }, [active, tourId, currentIndex, id, screenWidth, screenHeight, yOffset])

  return (
    <View ref={ref} style={[{ position: 'relative' }, style]} collapsable={false}>
      {children}
      {showPendingHighlight && <PendingHighlightRing id={id} targetRef={ref} yOffset={yOffset} />}
    </View>
  )
}
