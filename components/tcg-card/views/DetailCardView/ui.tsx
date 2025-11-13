import { BlurBackground } from '@/components/Background'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { measureAsync } from '@/components/utils'
import { ComponentProps, useEffect, useLayoutEffect, useRef } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'

const { height: H, width: W } = Dimensions.get('window')

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
  mainContentBreakpoint?: Animated.SharedValue<number>
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
  const mainContentRef = useRef<View | null>(null)
  const mainContentBreakpoint = useSharedValue(0)
  const fullContentRef = useRef<View | null>(null)
  const fullContentBreakpoint = useSharedValue(0)
  const extraSnapSV = useSharedValue<number[]>([]) // mirror prop into a shared value

  const restMain = useDerivedValue(
    () => Math.min(mainContentBreakpoint?.value ?? 80, 80) + insets.bottom,
    [mainContentBreakpoint, insets]
  )

  const restFull = useDerivedValue(
    () => fullContentBreakpoint?.value,
    [fullContentBreakpoint, insets]
  )

  const SNAP = useDerivedValue(() => {
    'worklet'
    const arr = [restMain.value, restFull.value, ...extraSnapSV.value]
    // unique + sort (worklet-safe)
    const uniq: number[] = []
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i]
      if (!uniq.includes(v)) uniq.push(v)
    }
    uniq.sort((a, b) => a - b)
    return uniq
  })

  const toggleLockedSV = useSharedValue<boolean | undefined>(undefined)
  const translateY = useSharedValue(restMain.value)
  const startY = useSharedValue(restMain.value)
  const isLocked = useSharedValue(false)
  const setLocked = (next: boolean) => {
    console.log(next)
    onLockedChange?.(next)
  }

  useLayoutEffect(() => {
    if (mainContentRef.current) {
      measureAsync(mainContentRef as React.RefObject<View>).then(({ height }) => {
        mainContentBreakpoint.set(height)
      })
    }
  }, [mainContentRef.current])

  useLayoutEffect(() => {
    if (fullContentRef.current) {
      measureAsync(fullContentRef as React.RefObject<View>).then(({ height }) => {
        fullContentBreakpoint.value = height
      })
    }
  }, [fullContentRef.current])

  useEffect(() => {
    toggleLockedSV.value = toggleLocked
  }, [toggleLocked])

  // assume SNAP is a derived shared value: const SNAP = useDerivedValue<number[]>(...)

  // Optional: keep a derived "targetY" so you can observe a single number change
  const targetY = useDerivedValue<number>(() => {
    const arr = SNAP.value
    if (!arr.length) return 0 // fallback
    return toggleLockedSV.value ? arr[arr.length - 1] : arr[0]
  })

  useAnimatedReaction(
    () => targetY.value,
    (to) => {
      // isLocked bookkeeping
      const next = toggleLockedSV.value ?? false
      if (isLocked.value !== next) {
        isLocked.value = next
        runOnJS(setLocked)?.(next)
      }
      translateY.value = withSpring(to, { damping: 18, stiffness: 100 })
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

      if (isLocked.value !== nextLocked) {
        isLocked.value = nextLocked
        runOnJS(setLocked)?.(nextLocked)
      }
      translateY.value = withSpring(to, { damping: 18, stiffness: 100 })
    })

  const composed = Gesture.Simultaneous(pan)

  const cardStyle = useAnimatedStyle(() => ({
    top: H - translateY.value,
  }))

  const thumbStyle = useAnimatedStyle(() => ({
    // subtle feedback when “armed” near the lock
    opacity: translateY.value < SNAP.value[1] / 2 ? 0.9 : 0.2,
  }))

  return (
    <Animated.View
      style={[style, thumbStyles.sheet, cardStyle, { width: W + 4, position: 'absolute' }]}
      className="flex flex-col items-center"
      ref={fullContentRef}
    >
      <BlurBackground
        style={[thumbStyles.sheetInner, { flex: 1, width: '100%' }]}
        opacity={[0.1, 0.5]}
      >
        <GestureDetector gesture={composed}>
          <Animated.View style={thumbStyles.mainContent} ref={mainContentRef}>
            <Animated.View style={thumbStyles.thumbContainer}>
              <Animated.View style={[thumbStyles.thumb, thumbStyle]} />
            </Animated.View>
            {mainContent}
          </Animated.View>
        </GestureDetector>

        {children}
      </BlurBackground>
    </Animated.View>
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
    left: -2,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: Colors.$outlineNeutral,
    backgroundColor: Colors.rgba(Colors.$backgroundNeutral, 0.9),
    borderWidth: 2,
  },

  sheetInner: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
})
