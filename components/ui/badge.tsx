import * as Haptics from 'expo-haptics'
import { LucideIcon } from 'lucide-react-native'
import { ComponentProps } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { BorderRadiuses, Chip, Colors } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
require('@/assets/rn-ui')
const AnimatedView = Animated.createAnimatedComponent(View)

export const BASE_BADGE_HEIGHT = 36
export const BASE_ICON_SIZE = 20

export const BaseBadgeProps: Partial<ComponentProps<typeof Chip>> = {
  iconStyle: {
    width: BASE_ICON_SIZE,
    height: BASE_ICON_SIZE,
  },
  size: BASE_BADGE_HEIGHT,
  backgroundColor: Colors.$backgroundPrimaryHeavy,
  containerStyle: {
    borderWidth: 0,
    padding: 2,
    paddingLeft: 4,
  },
  labelStyle: {
    color: Colors.$textDefault,
    fontSize: 16,
    lineHeight: 18,
  },
}

export const SQUARE_BADGE_HEIGHT = 32
export const SQUARE_ICON_SIZE = 18

export const SquareBadgeProps: Partial<ComponentProps<typeof Chip>> = {
  iconStyle: {
    width: SQUARE_ICON_SIZE,
    height: SQUARE_ICON_SIZE,
  },
  size: SQUARE_BADGE_HEIGHT,
  backgroundColor: Colors.$backgroundPrimaryHeavy,
  containerStyle: {
    borderWidth: 0,
    padding: 6,
    paddingLeft: 10,
  },
  labelStyle: {
    color: Colors.$textDefault,
    fontSize: 14,
    lineHeight: 16,
  },
  borderRadius: BorderRadiuses.br20,
}

export function ToggleBadge({
  checked,
  onPress,
  onCheckedChange,
  ...props
}: ComponentProps<typeof Badge> & {
  className?: string
  children?: React.ReactNode
  checked: boolean
  onPress?: () => void
  onCheckedChange?: (checked: boolean) => void
}) {
  const scale = useSharedValue(1)

  const onTogglePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onCheckedChange?.(!checked)
    onPress?.()
  }

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onBegin(() => {
      'worklet'
      scale.value = withTiming(0.98, { duration: 80 })
    })
    .onEnd(() => {
      'worklet'
      scale.value = withTiming(1, { duration: 80 })
      scheduleOnRN(onTogglePress)
    })
    .onFinalize(() => {
      'worklet'
      scale.value = withTiming(1, { duration: 80 })
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: withTiming(checked ? 1 : 0.5, { duration: 120 }),
  }))

  return (
    <GestureDetector gesture={tap}>
      <AnimatedView style={animatedStyle}>
        {/* Important: avoid inner Pressables here so RNGH owns the touch */}
        <Badge {...props} />
      </AnimatedView>
    </GestureDetector>
  )
}

export function Badge({
  variant = 'default',
  icon: Icon,
  leftElement,
  style,
  ...props
}: ComponentProps<typeof Chip> & { variant?: 'default' | 'square'; icon?: LucideIcon }) {
  const variantProps = variant === 'default' ? BaseBadgeProps : SquareBadgeProps

  return (
    <Chip
      leftElement={
        Icon ? (
          <Icon
            size={(variantProps.iconStyle?.height! as number) || BASE_BADGE_HEIGHT}
            color={Colors.$textDefault}
            strokeWidth={2.5}
            style={{ marginLeft: 4 }}
          />
        ) : (
          leftElement
        )
      }
      {...variantProps}
      {...props}
    />
  )
}
