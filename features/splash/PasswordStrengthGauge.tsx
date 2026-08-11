import { Text } from '@/components/ui/text/base-text'
import { Check, X } from 'lucide-react-native'
import React, { useEffect } from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { type PasswordPolicy, type RuleResult, evaluatePassword } from './usePasswordPolicy'

type Props = {
  password: string
  policy: PasswordPolicy
  focused?: boolean
  /**
   * 'inline' (default) grows in the normal layout flow, pushing content below it down.
   * 'floating' anchors as an absolute overlay instead, so it never displaces sibling
   * content — pass `placement` to control which side of the anchor it expands into.
   */
  variant?: 'inline' | 'floating'
  /** Only meaningful when variant="floating". Defaults to 'below'. */
  placement?: 'above' | 'below'
}

const SEGMENT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'] as const

export function PasswordStrengthGauge({
  password,
  policy,
  focused,
  variant = 'inline',
  placement = 'below',
}: Props) {
  const EMPTY_COLOR = Colors.rgba(Colors.$textDefault, 0.12)
  const { score, label, rules } = evaluatePassword(password, policy)
  const visible = !!password.length || !!focused

  // Animate a 0→1 progress value; derive maxHeight and opacity from it.
  // Using maxHeight avoids measuring the content — the container simply
  // reveals/hides its children without needing to know their exact height.
  const progress = useSharedValue(visible ? 1 : 0)

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: 220 })
  }, [visible])

  const containerStyle = useAnimatedStyle(() => ({
    maxHeight: progress.value * 400,
    opacity: progress.value,
    overflow: 'hidden',
  }))

  const activeColor = score > 0 ? SEGMENT_COLORS[score - 1] : EMPTY_COLOR

  const floatingStyle =
    variant === 'floating'
      ? ({
          position: 'absolute',
          left: 0,
          right: 0,
          zIndex: 20,
          elevation: 20,
          ...(placement === 'above'
            ? ({ bottom: '100%', marginBottom: 8 } as const)
            : ({ top: '100%', marginTop: 8 } as const)),
        } as const)
      : undefined

  return (
    <Animated.View style={[containerStyle, floatingStyle]}>
      <View
        style={{
          width: '100%',
          ...(variant === 'floating'
            ? {
                backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.96),
                borderWidth: 1,
                borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
                borderRadius: 14,
                padding: 12,
              }
            : null),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: 4, paddingVertical: 4 }}>
            {([1, 2, 3, 4] as const).map((seg) => (
              <Segment key={seg} filled={score >= seg && visible} color={activeColor as string} />
            ))}
          </View>
          <Text style={{ fontSize: 12, fontWeight: '600', color: activeColor, minWidth: 36 }}>
            {label}
          </Text>
        </View>
        {rules.map((rule) => (
          <RuleRow key={rule.label} {...rule} />
        ))}
      </View>
    </Animated.View>
  )
}

function Segment({ filled, color }: { filled: boolean; color: string }) {
  const EMPTY_COLOR = Colors.rgba(Colors.$textDefault, 0.12) as string
  const style = useAnimatedStyle(() => ({
    backgroundColor: withTiming(filled ? color : EMPTY_COLOR, { duration: 250 }),
  }))
  return <Animated.View style={[{ height: 4, flex: 1, borderRadius: 2 }, style]} />
}

function RuleRow({ label, met }: RuleResult) {
  const color = met ? '#22c55e' : Colors.rgba(Colors.$textSuccess, 0.45)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {met ? <Check size={13} color={color} /> : <X size={13} color={color} />}
      <Text style={{ fontSize: 12, color }}>{label}</Text>
    </View>
  )
}
