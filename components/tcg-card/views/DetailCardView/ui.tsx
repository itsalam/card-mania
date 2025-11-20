import { BlurBackground } from '@/components/Background'
import { useMeasure } from '@/components/hooks/useMeasure'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { ComponentProps, useEffect } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'

import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { formatLabel, formatPrice, splitToNChunks } from '@/components/utils'
import { Eye, EyeOff, Plus } from 'lucide-react-native'
import React, { useMemo } from 'react'
import { ScrollView } from 'react-native'

const { width: W, height: H } = Dimensions.get('window')

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
      <Heading style={{ color: backgroundColor }} size="lg" className="font-spaceMono">
        {title}
      </Heading>
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
  style?: ComponentProps<typeof View>['style']
  mainContentBreakpoint?: SharedValue<number>
  mainContent?: React.ReactNode
}

export default function DraggableThumbContent({
  onLockedChange,
  children,
  style,
  mainContent,
  toggleLocked,
}: ThumbProps) {
  const insets = useSafeAreaInsets()
  const {
    ref: mainContentRef,
    layout: mainContentLayout,
    onLayout: onMainContentLayout,
  } = useMeasure<Animated.View>()
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
    () => fullContentLayout?.height,
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
        onLockedChange && runOnJS(onLockedChange)?.(next)
      }
      translateY.value = withSpring(to, { damping: 20, stiffness: 150 })
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
        onLockedChange && runOnJS(onLockedChange)?.(nextLocked)
      }
      translateY.value = withSpring(to, { damping: 20, stiffness: 150 })
    })

  const composed = Gesture.Simultaneous(pan)

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: -translateY.value,
      },
    ],
  }))

  const thumbStyle = useAnimatedStyle(() => ({
    // subtle feedback when “armed” near the lock
    opacity: translateY.value < SNAP.value[1] / 2 ? 0.9 : 0.2,
  }))

  const { height } = useReanimatedKeyboardAnimation() // <- shared values

  const detailContentStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isRevealed.value ? 1 : 0, { duration: 250 }),
    paddingBottom: Math.max(insets.bottom, -height.value + 12),
  }))

  return (
    <Animated.View
      style={[style, thumbStyles.sheet, cardStyle]}
      className="flex flex-col items-center"
      ref={fullContentRef}
      onLayout={onFullContentLayout}
    >
      <BlurBackground
        style={[thumbStyles.sheetInner, { flex: 1, width: '100%' }]}
        backgroundOpacity={0.95}
      >
        <GestureDetector gesture={composed}>
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
        </GestureDetector>
        <Animated.View
          style={[
            {
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              // backgroundColor: Colors.$backgroundNeutralLight,
            },
            detailContentStyle,
          ]}
        >
          {children}
        </Animated.View>
      </BlurBackground>
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
                  {selectedGrades.includes(key) ? <Eye size={16} /> : <EyeOff size={16} />}
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

const THUMB_SIZE = 5
const THUMB_PADDING = 8

export const thumbStyles = StyleSheet.create({
  thumbContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: THUMB_PADDING,
  },
  thumb: {
    backgroundColor: Colors.rgba(Colors.$backgroundDark, 0.3),
    height: THUMB_SIZE,
    width: '15%',
    borderRadius: 10,
  },
  mainContent: {
    width: '100%',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
  },
  sheet: {
    width: W + 4,
    position: 'absolute',
    top: '100%',
    left: -2,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: Colors.$outlineNeutral,
    borderWidth: 2,
  },

  sheetInner: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
})
