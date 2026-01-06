import { BlurBackground, BlurGradientBackground } from '@/components/Background'
import { MeasuredLayout, useMeasure } from '@/components/hooks/useMeasure'
import { Text } from '@/components/ui/text'
import { useEffect } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
  AnimatedStyle,
  interpolate,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Assets, Colors } from 'react-native-ui-lib'

import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { thumbStyles } from '@/components/ui/modal'
import { formatLabel, formatPrice, splitToNChunks } from '@/components/utils'
import { Eye, EyeOff, Plus, SearchX } from 'lucide-react-native'
import React, { useMemo } from 'react'
import { ScrollView } from 'react-native'
import { scheduleOnRN } from 'react-native-worklets'

export const Attribute = ({ label, value }: { label: string; value: string }) => {
  return (
    <View className="flex flex-col items-start justify-start">
      <Text className="text-muted-foreground text-left font-spaceMono text-sm">{label}</Text>
      <Text className="text-lg font-bold text-nowrap text-right">{value}</Text>
    </View>
  )
}

export const CardScreenHeader = (props: { title: string; backgroundColor?: string }) => {
  const { title, backgroundColor = Colors.rgba(Colors.$textPrimary, 0.8) } = props
  return (
    <View className="w-full py-1 flex flex-row items-center justify-center gap-3">
      <View style={{ backgroundColor, height: 1.5, width: 32 }} />
      <Text style={{ color: backgroundColor }} variant="large" className="font-spaceMono">
        {title}
      </Text>
      <View style={{ backgroundColor, height: 2, flex: 1, marginLeft: 6 }} />
    </View>
  )
}

// helper: pick nearest snap, biased by release velocity
function snapPoint(y: number, velocityY: number, snapPoints: number[]) {
  'worklet'
  // project the end position a bit in the velocity direction
  const projected = y + 0.2 * velocityY // 200ms of momentum
  let closest = snapPoints[0]
  let dist = Math.abs(projected - closest)
  for (let i = 1; i < snapPoints.length; i++) {
    const d = Math.abs(projected - snapPoints[i])
    if (d < dist) {
      dist = d
      closest = snapPoints[i]
    }
  }
  return closest
}

type ThumbProps = {
  /** Y (in px) where the card should lock (lower is higher on screen). Ex: 120 */
  lockY?: number
  /** bottom (rest) position of the card */
  restY?: number
  /** optional: additional snap points, e.g., half step */
  extraSnapPoints?: number[]
  /** called when we snap into/out of the lock */
  onLockedChange?: (locked: boolean) => void
  toggleLocked?: boolean
  children: React.ReactNode
  style?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>
  mainContentBreakpoint?: SharedValue<number>
  mainContent?: React.ReactNode
  onMainContentMeasure?: (ml?: MeasuredLayout) => void
  isKeyboardAccessory?: boolean
  containerStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>
}

export default function DraggableThumbContent({
  onLockedChange,
  children,
  style,
  mainContent,
  toggleLocked,
  isKeyboardAccessory,
  containerStyle,
  onMainContentMeasure,
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
            style={{
              zIndex: 2,
              display: 'flex',
              minHeight: 80,
            }}
            opacity={mainContentBlurOpacity}
          >
            <Animated.View
              style={thumbStyles.mainContent}
              ref={mainContentRef}
              onLayout={onMainContentLayout}
            >
              <Animated.View style={thumbStyles.thumbContainer}>
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

export const Prices = ({
  prices,
  visibleGrades,
  setSelectedGrades,
  selectedGrades,
  setShowMoreGrades,
}: {
  prices: [string, any][]
  visibleGrades: string[]
  setSelectedGrades: React.Dispatch<React.SetStateAction<string[]>>
  selectedGrades: string[]
  setShowMoreGrades: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const NUM_PRICE_ROWS = 2
  const rows = useMemo(
    () =>
      splitToNChunks(
        prices.filter(([key]) => visibleGrades.includes(key)),
        NUM_PRICE_ROWS
      ).filter((r) => r.length > 0),
    [prices, visibleGrades]
  )

  return (
    <ScrollView
      horizontal
      bounces={false}
      showsHorizontalScrollIndicator={true}
      alwaysBounceVertical={true}
      className="overflow-visible p-4"
      style={{ alignSelf: 'stretch', maxHeight: 200, flexGrow: 0, flexShrink: 0 }}
      contentContainerClassName="flex gap-2 flex-col"
    >
      {rows.map((row, i) => (
        <View key={`row-${i}`} className={'flex flex-row gap-2 overflow-visible pr-4'}>
          {row.map(([key, value]) => {
            return (
              <LiquidGlassCard
                className="flex items-center justify-center"
                style={{ opacity: value ? 1 : 0.5, minWidth: 100 }}
                size="sm"
                key={`${key}-${value}-${i}`}
                onPress={() => {
                  setSelectedGrades((prev) =>
                    prev.includes(key) ? prev.filter((grade) => grade !== key) : [...prev, key]
                  )
                }}
              >
                <View className="flex flex-row gap-2 items-center justify-end">
                  {selectedGrades.includes(key) ? (
                    <Eye size={16} color={Colors.$iconDefault} />
                  ) : (
                    <EyeOff size={16} color={Colors.$iconDefault} />
                  )}
                  <Text className="text-lg font-bold text-muted-foreground text-nowrap text-right font-spaceMono">
                    {formatLabel(key)}
                  </Text>
                </View>
                <Text className="text-3xl capitalize text-nowrap text-right">
                  {value ? formatPrice(value) : '--'}
                </Text>
              </LiquidGlassCard>
            )
          })}
          {rows.length === i + 1 && (
            <LiquidGlassCard
              className="flex items-center justify-center"
              style={{ aspectRatio: 1 }}
              size="sm"
              onPress={() => setShowMoreGrades((prev) => !prev)}
            >
              <Plus size={28} />
            </LiquidGlassCard>
          )}
        </View>
      ))}
    </ScrollView>
  )
}

export const THUMB_SIZE = 5
export const THUMB_PADDING = 8

export const VISIBILITY_OPTIONS = [
  {
    key: 'private' as const,
    icon: EyeOff,
    label: 'Private',
    description: 'Only you can see this collection.',
    iconSource: Assets.lucide['eye-off'],
  },
  {
    key: 'public' as const,
    icon: Eye,
    label: 'Public',
    description: 'Anyone can see this collection.',
    iconSource: Assets.lucide.eye,
  },
  {
    key: 'unlisted' as const,
    icon: SearchX,
    label: 'Unlisted',
    description: 'Only people with the link can see this collection.',
    iconSource: Assets.lucide['search-x'],
  },
] as const
