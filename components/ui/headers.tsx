// components/AppHeader.tsx
import { Text } from '@/components/ui/text/base-text'
import { BottomTabHeaderProps } from '@react-navigation/bottom-tabs'
import { Header, HeaderBackButton } from '@react-navigation/elements'
import { ChevronLeft } from 'lucide-react-native'
import React, { ComponentProps, useRef, useState } from 'react'
import { Pressable, StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native'
import Animated, {
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { Colors } from 'react-native-ui-lib'

const AnimatedSvgPath = Animated.createAnimatedComponent(Path)

export const OGEE_R = 10
export const PILL_R = 12
export const HEADER_ROW_H = 48 // fixed height of the header row in AppStandaloneHeader
// Visual height of the shoulder cutout pill — shorter than the header so the pill
// floats within the row rather than filling it top-to-bottom. The bottom arc
// (PILL_H → PILL_H + PILL_R) lands exactly at HEADER_ROW_H.
export const PILL_H = HEADER_ROW_H - PILL_R // 36

// Pill flush with the top-right corner. The SVG fill extends CR pixels left and CR pixels
// below the measured view bounds to cover the notch spaces left by the background's two
// convex corner arcs — without changing the pillW reported to the background.
function ShoulderCutout({
  content,
  onPress,
  onSize,
  pillWSv,
}: {
  content: React.ReactNode
  onPress: () => void
  onSize?: (w: number, h: number) => void
  /** Same SharedValue that drives the Skia background void — ensures the SVG path
   *  animates in lock-step with the gradient cutout via the same spring. */
  pillWSv?: SharedValue<number>
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  // maxCanvasW tracks the max ever-seen pill width; canvasWSv mirrors it for the worklet.
  const maxCanvasW = useRef(0)
  const canvasWSv = useSharedValue(0)
  const CR = PILL_R
  const hH = PILL_H
  const fill = Colors.$backgroundPrimaryHeavy

  // useDerivedValue + withSpring: survives re-renders without resetting — same fix as
  // BackgroundBase. Both derived values watch the same pillWSv with identical spring
  // params so the SVG path and Skia void stay frame-perfect in sync.
  const fallbackPillWSv = useSharedValue(0)
  const activePillWSv = pillWSv ?? fallbackPillWSv

  const animW = useDerivedValue(() => {
    'worklet'
    return withSpring(activePillWSv.value, { damping: 20, stiffness: 260, mass: 0.9 })
  })

  // Right-anchored path: the pill's right extent is fixed at the canvas right edge
  // (canvasW + CR), and the left extent (canvasW - w) moves leftward as the pill
  // grows. This ensures the animation expands RTL (toward the screen left) rather
  // than LTR, matching the Skia background void which also grows from the right.
  const animatedPathProps = useAnimatedProps(() => {
    'worklet'
    const w = animW.value
    const canvasW = canvasWSv.value
    if (w < 2 * CR || canvasW < 2 * CR) return { d: '' }
    const left = canvasW - w // pill's left extent — decreases as pill grows → RTL
    const right = canvasW + CR // pill's right extent — always at canvas right edge
    return {
      d: [
        `M ${left} 0`,
        `L ${right} 0`,
        `L ${right} ${hH + CR}`,
        `A ${CR} ${CR} 0 0 0 ${canvasW} ${hH}`,
        `L ${left + 2 * CR} ${hH}`,
        `A ${CR} ${CR} 0 0 1 ${left + CR} ${hH - CR}`,
        `L ${left + CR} ${CR}`,
        `A ${CR} ${CR} 0 0 0 ${left} 0`,
        'Z',
      ].join(' '),
    }
  }, [animW, canvasWSv]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clip the content to the animated pill width so it never overflows the SVG boundary
  // mid-spring. The clip view grows from right to left in sync with the pill SVG.
  const clipStyle = useAnimatedStyle(() => ({ width: animW.value }))

  return (
    // Outer View is sized to maxCanvasW (the max ever-seen content width) so the
    // CutoutReveal absolute anchor has a stable layout footprint. overflow:visible
    // lets the SVG canvas (size.w + CR) extend slightly beyond without clipping.
    <View style={{ height: hH, overflow: 'visible', width: size?.w ?? 0 }}>
      {size && (
        // right: 0 keeps the SVG canvas right edge pinned to the screen's right edge,
        // so the animated path always grows leftward (RTL) as the pill widens.
        <View style={{ position: 'absolute', right: 0, top: 0 }} pointerEvents="none">
          <Svg width={size.w + CR} height={hH + CR}>
            <AnimatedSvgPath fill={fill} animatedProps={animatedPathProps} />
          </Svg>
        </View>
      )}
      {/* Animated clip container — grows rightward→leftward with the spring so the
          content never bleeds outside the pill boundary during animation. */}
      <Animated.View
        style={[
          { position: 'absolute', right: 0, top: 0, height: hH, overflow: 'hidden' },
          clipStyle,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onPress}
          // position:absolute + right:0 keeps the content anchored to the pill's right
          // edge while the clip window expands leftward — leftmost items appear last.
          style={{
            position: 'absolute',
            right: 0,
            height: hH,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {/* Measure this wrapper — it has no flex, no overflow, no absolute children,
              so yoga correctly resizes it whenever {content} grows or shrinks. */}
          <View
            onLayout={(e) => {
              const { width } = e.nativeEvent.layout
              const totalW = width + 32 // + paddingHorizontal * 2
              if (totalW > 0) {
                maxCanvasW.current = Math.max(maxCanvasW.current, totalW)
                canvasWSv.value = maxCanvasW.current
                setSize({ w: maxCanvasW.current, h: hH })
                onSize?.(totalW, hH)
              }
            }}
          >
            {content}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

/** Use this for screens that live inside a React Navigation Stack */
export function AppNavHeader(props: BottomTabHeaderProps) {
  return (
    <Header
      title={props.options.title ?? ''}
      {...props}
      // unify styles here
      headerStyle={{ backgroundColor: '#0B0B0B' }}
      headerTitleAlign="center"
      headerTitleStyle={{ color: 'white', fontWeight: '600' }}
      headerLeft={(p) =>
        props.navigation.canGoBack() ? (
          <HeaderBackButton {...p} tintColor="white" onPress={props.navigation.goBack} />
        ) : null
      }
      headerRight={() => (
        <View style={{ paddingRight: 12 }}>
          {/* put a shared action button here if you want */}
        </View>
      )}
    />
  )
}

function CutoutReveal({
  cutout,
  onCutoutSize,
}: {
  cutout?: { content: React.ReactNode; onPress: () => void; pillWSv?: SharedValue<number> }
  onCutoutSize?: (w: number, h: number) => void
}) {
  const lastCutout = useRef(cutout)
  if (cutout) lastCutout.current = cutout
  if (!lastCutout.current) return null

  return (
    <View style={{ position: 'absolute', right: 0, top: 0 }}>
      <ShoulderCutout
        content={lastCutout.current.content}
        onPress={lastCutout.current.onPress}
        onSize={onCutoutSize}
        pillWSv={lastCutout.current.pillWSv}
      />
    </View>
  )
}

/** Use this *inside* a plain RN Modal (no navigator available) */
export function AppStandaloneHeader({
  title,
  onBack,
  right,
  background,
  style,
  variant = 'h4',
  children,
  cutout,
  onCutoutSize,
}: {
  children?: React.ReactNode
  title?: React.ReactNode
  onBack?: () => void
  right?: React.ReactNode
  background?: React.ReactNode
  style?: StyleProp<ViewStyle>
  variant?: ComponentProps<typeof Text>['variant']
  /** Waterfall-bevel pill rendered at the header's right edge. */
  cutout?: {
    content: React.ReactNode
    onPress: () => void
    /** Pass the same SharedValue used by the Skia background so the pill SVG
     *  spring-animates in lock-step with the gradient void. */
    pillWSv?: SharedValue<number>
  }
  /** Called once the shoulder cutout pill is measured — use to clip the background behind it. */
  onCutoutSize?: (w: number, h: number) => void
}) {
  return (
    <View style={[, style]}>
      {/*
       * Outer row: height = HEADER_ROW_H. overflow:visible so CutoutReveal's SVG can
       * extend CR pixels below without being clipped.
       *
       * Inner content row: overflow:hidden so the title/back-button never bleed visually
       * into the pill's transparent cutout zone. CutoutReveal is a sibling of this
       * overflow:hidden view so its absolutely-positioned SVG isn't affected by the clip.
       */}
      <View style={{ height: HEADER_ROW_H }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            height: HEADER_ROW_H,
            overflow: 'hidden',
          }}
        >
          {onBack && (
            <View style={{ width: 64, alignItems: 'flex-start' }}>
              <Pressable onPress={onBack} hitSlop={12}>
                <ChevronLeft size={24} color={Colors.$iconDefault} />
              </Pressable>
            </View>
          )}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant={variant}>{title}</Text>
            {children}
          </View>
          {/* Wider right placeholder when the pill cutout is present so the title
              doesn't crowd under the animated pill (which can reach ~100 px wide). */}
          <View style={{ width: cutout ? 96 : 64, alignItems: 'flex-end' }}>{right}</View>
        </View>
        <CutoutReveal cutout={cutout} onCutoutSize={onCutoutSize} />
      </View>
      {background}
    </View>
  )
}
