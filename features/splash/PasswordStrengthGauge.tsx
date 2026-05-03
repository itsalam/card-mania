import { Text } from '@/components/ui/text/base-text'
import { Check, X } from 'lucide-react-native'
import React, { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { type PasswordPolicy, type RuleResult, evaluatePassword } from './usePasswordPolicy'

type Props = {
  password: string
  policy: PasswordPolicy
  focused?: boolean
}

const SEGMENT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'] as const

const EMPTY_COLOR = 'rgba(255,255,255,0.12)'

export function PasswordStrengthGauge({ password, policy, focused }: Props) {
  const { score, label, rules } = evaluatePassword(password, policy)
  const visible = !!password.length || !!focused

  const [contentHeight, setContentHeight] = useState(0)
  const [measured, setMeasured] = useState(false)
  const heightSv = useSharedValue(0)
  const opacitySv = useSharedValue(0)

  useEffect(() => {
    const target = visible ? contentHeight : 0
    heightSv.value = withTiming(target, { duration: 220 })
    opacitySv.value = withTiming(visible ? 1 : 0, { duration: 180 })
  }, [visible, contentHeight, password, focused])

  useEffect(() => {
    if (!contentHeight) return
    heightSv.value = withTiming(focused ? contentHeight : 0, { duration: 220 })
  }, [focused, contentHeight])

  const containerStyle = useAnimatedStyle(() => ({
    height: heightSv.value,
    opacity: opacitySv.value,
    overflow: 'hidden',
  }))

  const activeColor = score > 0 ? SEGMENT_COLORS[score - 1] : EMPTY_COLOR

  const GaugeContent = () => (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {([1, 2, 3, 4] as const).map((seg) => (
            <Segment key={seg} filled={score >= seg && visible} color={activeColor} />
          ))}
        </View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: activeColor, minWidth: 36 }}>
          {label}
        </Text>
      </View>
      {rules.map((rule) => (
        <RuleRow key={rule.label} {...rule} />
      ))}
    </>
  )

  return (
    <Animated.View style={containerStyle}>
      {!measured && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', opacity: 0, left: 0, right: 0 }}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height
            if (h > 0) {
              setContentHeight(h)
              setMeasured(true)
            }
          }}
        >
          <GaugeContent />
        </View>
      )}
      <View style={{ gap: 10, width: '100%' }}>
        <GaugeContent />
      </View>
    </Animated.View>
  )
}

function Segment({ filled, color }: { filled: boolean; color: string }) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: withTiming(filled ? color : EMPTY_COLOR, { duration: 250 }),
  }))
  return <Animated.View style={[{ height: 4, flex: 1, borderRadius: 2 }, style]} />
}

function RuleRow({ label, met }: RuleResult) {
  const color = met ? '#22c55e' : 'rgba(255,255,255,0.45)'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {met ? <Check size={13} color={color} /> : <X size={13} color={color} />}
      <Text style={{ fontSize: 12, color }}>{label}</Text>
    </View>
  )
}
