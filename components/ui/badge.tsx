import * as Haptics from 'expo-haptics'
import { ComponentProps, ComponentPropsWithoutRef } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { Chip, ChipsInput, Colors } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
require('@/assets/rn-ui')
const AnimatedView = Animated.createAnimatedComponent(View)

export const BADGE_HEIGHT = 36
export const ICON_SIZE = 28

export const BaseBadgeProps: Partial<ComponentProps<typeof Chip>> = {
  iconStyle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    marginLeft: 10,
  },
  size: BADGE_HEIGHT,
  backgroundColor: Colors.$backgroundPrimaryHeavy,
  containerStyle: {
    borderWidth: 0,
    padding: 2,
  },
  labelStyle: {
    color: Colors.$textDefaultLight,
    fontSize: 16,
    lineHeight: 18,
  },
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
        <Badge {...BaseBadgeProps} {...props} />
      </AnimatedView>
    </GestureDetector>
  )
}

export function Badge({ ...props }: ComponentProps<typeof Chip>) {
  return <Chip {...BaseBadgeProps} {...props} />
}

export const BadgeInput = ({
  defaultChipProps,
  ...props
}: ComponentPropsWithoutRef<typeof ChipsInput>) => {
  // Deep merge BaseBadgeProps and defaultChipProps
  const mergedChipProps = {
    ...BaseBadgeProps,
    ...defaultChipProps,
    iconStyle: [BaseBadgeProps.iconStyle, defaultChipProps?.iconStyle || {}],
    containerStyle: [
      BaseBadgeProps.containerStyle,
      defaultChipProps?.containerStyle || {},
      {
        marginTop: 0,
      },
    ],
    labelStyle: [BaseBadgeProps.labelStyle, defaultChipProps?.labelStyle || {}],
  }
  return <ChipsInput {...props} defaultChipProps={mergedChipProps} />
}
