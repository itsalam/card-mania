import { Text } from '@/components/ui/text/base-text'
import * as Haptics from 'expo-haptics'
import { LucideIcon } from 'lucide-react-native'
import { ReactNode } from 'react'
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
require('@/assets/rn-ui')

// ── Constants ─────────────────────────────────────────────────────────────────

export const BASE_BADGE_HEIGHT = 36
export const BASE_ICON_SIZE = 20
export const SQUARE_BADGE_HEIGHT = 32
export const SQUARE_ICON_SIZE = 40

// ── Chip ──────────────────────────────────────────────────────────────────────

type ChipSize = number | { width?: number; height?: number }

export type ChipProps = {
  label?: string
  labelStyle?: StyleProp<TextStyle>
  /** Element rendered to the left of the label. Reduces left padding to 8. */
  leftElement?: ReactNode
  /** Element rendered to the right of the label. Reduces right padding to 8. */
  rightElement?: ReactNode
  /** Avatar component. Rendered flush-left with 2px inset; rest of content stays centered. */
  avatar?: ReactNode
  backgroundColor?: string
  borderRadius?: number
  /** Additional style applied to the container after computed padding. */
  containerStyle?: StyleProp<ViewStyle>
  size?: ChipSize
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function Chip({
  label,
  labelStyle,
  leftElement,
  rightElement,
  avatar,
  backgroundColor = Colors.$backgroundPrimaryHeavy,
  borderRadius = BorderRadiuses.br100,
  containerStyle,
  size = 26,
  onPress,
  style,
  testID,
}: ChipProps) {
  const minHeight = typeof size === 'object' ? (size.height ?? 26) : size
  const minWidth = typeof size === 'object' ? size.width : undefined

  // Padding rules:
  //   avatar present  → paddingLeft: 2  (flush to edge)
  //   leftElement     → paddingLeft: 8
  //   default         → paddingLeft: 12
  //   rightElement    → paddingRight: 8
  //   default         → paddingRight: 12
  const paddingLeft = avatar ? 2 : leftElement ? 8 : 12
  const paddingRight = rightElement ? 8 : 12

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor,
          borderRadius,
          minHeight,
          ...(minWidth != null && { minWidth }),
          paddingLeft,
          paddingRight,
        },
        containerStyle,
        style,
      ]}
      testID={testID}
    >
      {avatar}
      {leftElement}
      {label != null && (
        <Text variant="badge" style={[styles.chipLabel, labelStyle]} numberOfLines={1}>
          {label}
        </Text>
      )}
      {rightElement}
    </Pressable>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────

export type BadgeProps = ChipProps & {
  variant?: 'default' | 'square'
  icon?: LucideIcon
}

// Exported for backward compatibility (badge-input.tsx reads these fields)
export const BaseBadgeProps = {
  iconStyle: { width: BASE_ICON_SIZE, height: BASE_ICON_SIZE },
  containerStyle: {} as StyleProp<ViewStyle>,
  labelStyle: { color: Colors.$textDefault } as StyleProp<TextStyle>,
  size: { height: BASE_BADGE_HEIGHT } as ChipSize,
  backgroundColor: Colors.$backgroundPrimaryHeavy,
}

export const SquareBadgeProps = {
  iconStyle: { width: SQUARE_ICON_SIZE, height: SQUARE_ICON_SIZE },
  containerStyle: {} as StyleProp<ViewStyle>,
  labelStyle: { color: Colors.$textDefault } as StyleProp<TextStyle>,
  size: { height: SQUARE_BADGE_HEIGHT } as ChipSize,
  backgroundColor: Colors.$backgroundPrimaryHeavy,
  borderRadius: BorderRadiuses.br20 as number,
}

export function Badge({
  variant = 'default',
  icon: Icon,
  leftElement,
  labelStyle,
  ...props
}: BadgeProps) {
  const isSquare = variant === 'square'
  const defaults = isSquare ? SquareBadgeProps : BaseBadgeProps

  return (
    <Chip
      size={defaults.size}
      backgroundColor={defaults.backgroundColor}
      {...(isSquare && { borderRadius: SquareBadgeProps.borderRadius })}
      labelStyle={[defaults.labelStyle, labelStyle]}
      leftElement={
        Icon ? (
          <Icon size={BASE_ICON_SIZE} color={Colors.$textDefault} strokeWidth={2.5} />
        ) : (
          leftElement
        )
      }
      {...props}
    />
  )
}

// ── ToggleBadge ───────────────────────────────────────────────────────────────

export function ToggleBadge({
  checked,
  onPress,
  onCheckedChange,
  style,
  ...props
}: BadgeProps & {
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
      <Animated.View style={[style, animatedStyle]}>
        <Badge {...props} />
      </Animated.View>
    </GestureDetector>
  )
}

// ── ChipRowContainer ──────────────────────────────────────────────────────────

export const ChipRowContainer = ({ label, children }: { label?: string; children: ReactNode }) => {
  return (
    <View>
      {label && (
        <Text variant="muted" style={styles.chipRowLabel}>
          {label}
        </Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRowContainer}
        style={styles.chipRow}
      >
        {children}
      </ScrollView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  chipLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'visible',
    paddingHorizontal: 16,
  },
  chipRowContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 12,
  },
  chipRowLabel: {
    paddingHorizontal: 16,
    opacity: 0.7,
    paddingBottom: 4,
  },
})
