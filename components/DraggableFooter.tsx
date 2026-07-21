import { ThumbProps, snapPoint } from '@/features/tcg-card-views/DetailCardView/components/ui'
import React, { useEffect } from 'react'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, View } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
import { BlurBackground, BlurGradientBackground } from './Background'
import { useMeasure } from './hooks/useMeasure'
import { thumbStyles } from './ui/modal'

// reverseExpand: height of the drag thumb revealed ABOVE the pinned bar when
// collapsed, so it stays visible and touchable for the pan gesture. The full
// collapsed peek = pinned bar height + this (the sheet's bottom barHeight sits
// behind the pinned bar). Tune to the thumb container's height.
const THUMB_PEEK = 24

export default function DraggableFooter({
  onLockedChange,
  children,
  style,
  mainContent,
  toggleLocked,
  isKeyboardAccessory,
  containerStyle,
  onMainContentMeasure,
  absoluteThumb = false,
  reverseExpand = false,
}: ThumbProps) {
  const { progress: keyboardProgress, height: keyboardHeight } = useReanimatedKeyboardAnimation()
  const insets = useSafeAreaInsets()
  const {
    ref: mainContentRef,
    layout: mainContentLayout,
    onLayout: onMainContentLayout,
  } = useMeasure<Animated.View>({ onMeasure: onMainContentMeasure })
  const {
    ref: fullContentRef,
    layout: fullContentLayout,
    onLayout: onFullContentLayout,
  } = useMeasure<Animated.View>()
  const extraSnapSV = useSharedValue<number[]>([]) // mirror prop into a shared value

  const restMain = useDerivedValue(
    () => Math.min(mainContentLayout?.height ?? 80, 80) + 12,
    [mainContentLayout?.height, insets]
  )
  // Full reveal distance. Normal mode subtracts the safe area (its content carries
  // a bottom inset pad). reverseExpand ADDS the pinned bar height so the reveal
  // lands the sheet's bottom edge exactly on the bar's top — everything above the
  // bar, nothing hidden behind it (reserved in the reveal, not via padding).
  const restFull = useDerivedValue(
    () =>
      (fullContentLayout?.height ?? 0) +
      (reverseExpand ? (mainContentLayout?.height ?? 0) : -insets.bottom),
    [fullContentLayout?.height, mainContentLayout?.height, insets, reverseExpand]
  )

  // Collapsed peek. In reverseExpand the bar is pinned separately; collapse so the
  // sheet's bottom barHeight tucks behind the pinned bar while the top THUMB_PEEK
  // (the drag thumb) still shows above it and stays grabbable.
  const restCollapsed = useDerivedValue(
    () => (reverseExpand ? (mainContentLayout?.height ?? 0) + THUMB_PEEK : restMain.value),
    [reverseExpand, mainContentLayout?.height]
  )

  const SNAP = useDerivedValue(() => {
    'worklet'
    const arr = [restCollapsed.value, restFull.value, ...extraSnapSV.value]
    // unique + sort (worklet-safe)
    const uniq: number[] = []
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i]

      if (v !== undefined && !uniq.includes(v)) uniq.push(v)
    }
    uniq.sort((a, b) => a - b)
    return uniq
  })

  const toggleRevealedSV = useSharedValue<boolean | undefined>(undefined)
  const translateY = useSharedValue(restCollapsed.value)
  const startY = useSharedValue(restCollapsed.value)
  const isRevealed = useSharedValue(toggleLocked)

  useEffect(() => {
    toggleRevealedSV.value = toggleLocked
  }, [toggleLocked])

  // assume SNAP is a derived shared value: const SNAP = useDerivedValue<number[]>(...)
  // Optional: keep a derived "targetY" so you can observe a single number change
  const targetY = useDerivedValue<number>(() => {
    const arr = SNAP.value
    if (!arr.length) return 0 // fallback
    return toggleRevealedSV.value ? arr[arr.length - 1] : arr[0]
  })

  useAnimatedReaction(
    () => targetY.value,
    (to) => {
      // isLocked bookkeeping
      const next = toggleRevealedSV.value ?? false
      if (isRevealed.value !== next) {
        isRevealed.value = next
        onLockedChange && scheduleOnRN(onLockedChange, next)
      }
      translateY.value = withSpring(to, { damping: 100, stiffness: 300 })
    }
  )

  useAnimatedReaction(
    () => restCollapsed.value, // watch the derived collapsed peek
    (curr) => {
      // keep the sheet resting at the collapsed peek until revealed
      if (!(toggleRevealedSV.value ?? false)) {
        translateY.value = curr
      }
    }
  )

  const pan = Gesture.Pan()
    .onBegin(() => {
      startY.value = translateY.value
    })
    .onChange((e) => {
      // positive e.translationY is downward
      const next = startY.value - e.translationY
      const points = SNAP.value
      if (!points.length) return
      // clamp between collapsed peek and the last (full) snap point
      const last = points[points.length - 1]
      translateY.value = Math.min(Math.max(next, restCollapsed.value), last)
    })
    .onEnd((e) => {
      const points = SNAP.value
      if (!points.length) return

      // velocityY is already positive when moving down
      const to = snapPoint(translateY.value, -e.velocityY, SNAP.value)

      const last = points[points.length - 1]
      const EPS = 0.5 // pixels; adjust to taste
      const nextLocked = Math.abs(to - last) <= EPS

      if (isRevealed.value !== nextLocked) {
        isRevealed.value = nextLocked
        onLockedChange && scheduleOnRN(onLockedChange, nextLocked)
      }
      translateY.value = withSpring(to, { damping: 100, stiffness: 300 })
    })

  const composed = Gesture.Simultaneous(pan)

  // Keyboard offset shared by the sheet and the pinned bar so they stay aligned.
  const keyboardOffset = useDerivedValue(() =>
    isKeyboardAccessory ? interpolate(keyboardProgress.value, [0, 1], [0, keyboardHeight.value]) : 0
  )

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: -translateY.value + keyboardOffset.value,
      },
    ],
  }))

  // Pinned bar (reverseExpand): only the keyboard offset — no expansion term, so
  // it stays fixed to the viewport bottom while the detail sheet expands above it.
  const fromColor = useSharedValue(Colors.rgba(Colors.$backgroundDefault, 0))
  const toColor = useSharedValue(Colors.rgba(Colors.$backgroundDefault, 0.0))
  const pinnedBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboardOffset.value }],
  }))

  const fullOpacity = useDerivedValue(() => 1)

  const thumbStyle = useAnimatedStyle(() => ({
    // subtle feedback when “armed” near the lock
    opacity: translateY.value < SNAP.value[1] / 2 ? 0.9 : 0.2,
  }))

  const paddingBottom = useDerivedValue(
    () =>
      insets.bottom +
      (isKeyboardAccessory
        ? 0
        : interpolate(
            keyboardProgress.value,
            [0, 1],
            [0, -keyboardHeight.value + 20 - insets.bottom]
          )),
    [keyboardProgress, isKeyboardAccessory, keyboardHeight]
  )

  const mainContentBlurOpacity = useDerivedValue<number>(() =>
    withTiming(isRevealed.value ? 1 : 0, { duration: 250 })
  )

  const detailContentStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(isRevealed.value ? 1 : 0, { duration: 250 }),
      // reverseExpand pads the bottom by the pinned bar height (below) via a plain
      // style; normal mode uses the keyboard-aware paddingBottom here.
      ...(reverseExpand ? {} : { paddingBottom: paddingBottom.value }),
    }),
    [paddingBottom, reverseExpand]
  )

  const thumbContainer = (
    <Animated.View
      style={[
        thumbStyles.thumbContainer,
        absoluteThumb ? thumbStyles.absoluteThumbContainer : null,
      ]}
    >
      <Animated.View
        style={[
          thumbStyles.thumb,
          { backgroundColor: Colors.rgba(Colors.$backgroundNeutralIdle, 0.8) },
          thumbStyle,
        ]}
      />
    </Animated.View>
  )

  // Normal mode: mainContent lives inside the translated sheet.
  const mainContentContainer = (
    <Animated.View
      style={[thumbStyles.mainContent, { paddingBottom: insets.bottom }]}
      ref={mainContentRef}
      onLayout={onMainContentLayout}
    >
      {thumbContainer}
      {mainContent}
    </Animated.View>
  )

  const detailContainer = (
    <Animated.View
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        zIndex: 1,
      }}
    >
      {reverseExpand && thumbContainer}
      <Animated.View
        style={[
          reverseExpand && thumbStyles.mainContent,
          reverseExpand && { paddingBottom: insets.bottom },
          detailContentStyle,
          style,
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  )

  const sheet = (
    <Animated.View
      style={[
        containerStyle,
        thumbStyles.sheet,
        {
          borderColor: Colors.$outlineNeutral,
        },
        cardStyle,
      ]}
      className="flex flex-col items-center"
      ref={fullContentRef}
    >
      <BlurGradientBackground
        style={[thumbStyles.sheetInner, { flex: 1, alignSelf: 'stretch', paddingBottom: 400 }]}
        backgroundOpacity={0.95}
        opacity={mainContentBlurOpacity}
      >
        <View onLayout={onFullContentLayout}>
          <GestureDetector gesture={composed}>
            <BlurBackground
              style={[{ zIndex: 2, display: 'flex', minHeight: 52, alignSelf: 'stretch' }]}
            >
              {reverseExpand ? detailContainer : mainContentContainer}
            </BlurBackground>
          </GestureDetector>
          {!reverseExpand && detailContainer}
        </View>
      </BlurGradientBackground>
    </Animated.View>
  )

  if (!reverseExpand) return sheet

  // reverseExpand: the detail sheet expands above a bar that is pinned to the
  // viewport bottom (moves only with the keyboard).
  const pinnedBar = (
    <Animated.View
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10 }, pinnedBarStyle]}
      ref={mainContentRef}
      onLayout={onMainContentLayout}
    >
      <BlurBackground
        style={[{ alignSelf: 'stretch', paddingBottom: insets.bottom }]}
        opacity={fullOpacity}
      >
        {mainContent}
      </BlurBackground>
    </Animated.View>
  )

  return (
    <>
      {sheet}
      {pinnedBar}
    </>
  )
}
