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
import { scheduleOnRN } from 'react-native-worklets'
import { BlurBackground, BlurGradientBackground } from './Background'
import { useMeasure } from './hooks/useMeasure'
import { thumbStyles } from './ui/modal'

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
    () => Math.min(mainContentLayout?.height ?? 80, 80) + insets.bottom,
    [mainContentLayout?.height, insets]
  )
  const restFull = useDerivedValue(
    () => (fullContentLayout?.height ?? 0) - insets.bottom,
    [fullContentLayout?.height, insets]
  )

  const SNAP = useDerivedValue(() => {
    'worklet'
    const arr = [restMain.value, restFull.value, ...extraSnapSV.value]
    // unique + sort (worklet-safe)
    const uniq: number[] = []
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i]

      if (v && !uniq.includes(v)) uniq.push(v)
    }
    uniq.sort((a, b) => a - b)
    return uniq
  })

  const toggleRevealedSV = useSharedValue<boolean | undefined>(undefined)
  const translateY = useSharedValue(restMain.value)
  const startY = useSharedValue(restMain.value)
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
    () => restMain.value, // watch the derived value
    (curr) => {
      // update the other SV on the UI thread
      translateY.value = curr // or withSpring(curr) if you want animation
    }
  )

  const pan = Gesture.Pan()
    .onBegin(() => {
      startY.value = translateY.value
    })
    .onChange((e) => {
      // positive e.translationY is downward
      const next = startY.value - e.translationY
      // optional clamp so it doesn't go above top or below rest + overshoot
      translateY.value = Math.max(next, restMain.value)
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

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          -translateY.value +
          (isKeyboardAccessory
            ? interpolate(keyboardProgress.value, [0, 1], [0, keyboardHeight.value])
            : 0),
      },
    ],
  }))

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
      paddingBottom: paddingBottom.value,
    }),
    [paddingBottom]
  )

  return (
    <Animated.View
      style={[containerStyle, thumbStyles.sheet, cardStyle]}
      className="flex flex-col items-center"
      ref={fullContentRef}
      onLayout={onFullContentLayout}
    >
      <BlurGradientBackground
        style={[thumbStyles.sheetInner, { flex: 1, width: '100%' }]}
        backgroundOpacity={0.95}
      >
        <GestureDetector gesture={composed}>
          <BlurBackground
            style={[
              {
                zIndex: 2,
                display: 'flex',
                minHeight: 52,
              },
            ]}
            opacity={mainContentBlurOpacity}
          >
            <Animated.View
              style={thumbStyles.mainContent}
              ref={mainContentRef}
              onLayout={onMainContentLayout}
            >
              <Animated.View
                style={[
                  thumbStyles.thumbContainer,
                  absoluteThumb ? thumbStyles.absoluteThumbContainer : null,
                ]}
              >
                <Animated.View style={[thumbStyles.thumb, thumbStyle]} />
              </Animated.View>

              {mainContent}
            </Animated.View>
          </BlurBackground>
        </GestureDetector>
        <Animated.View
          style={[
            {
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              zIndex: 1,
            },
            detailContentStyle,
            style,
          ]}
        >
          {children}
        </Animated.View>
      </BlurGradientBackground>
    </Animated.View>
  )
}
