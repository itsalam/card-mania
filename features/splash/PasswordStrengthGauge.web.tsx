import { Text } from '@/components/ui/text/base-text'
import { Check, X } from 'lucide-react-native'
import React, { useEffect, useRef } from 'react'
import { Animated, Easing, View } from 'react-native'
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
  const activeColor = score > 0 ? SEGMENT_COLORS[score - 1] : EMPTY_COLOR

  console.log('[PasswordStrengthGauge.web] render', {
    password: password.length,
    focused,
    visible,
    score,
  })

  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.ease,
      useNativeDriver: false,
    }).start()
  }, [visible])

  return (
    <Animated.View
      style={{
        overflow: 'hidden',
        width: '100%',
        maxHeight: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }),
        opacity: progress,
      }}
    >
      <View style={{ gap: 10, width: '100%', paddingTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
            {([1, 2, 3, 4] as const).map((seg) => (
              <View
                key={seg}
                style={[
                  { height: 4, flex: 1, borderRadius: 2 },
                  {
                    backgroundColor: score >= seg && visible ? activeColor : EMPTY_COLOR,
                    transition: 'background-color 250ms ease',
                  } as any,
                ]}
              />
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

function RuleRow({ label, met }: RuleResult) {
  const color = met ? '#22c55e' : 'rgba(255,255,255,0.45)'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {met ? <Check size={13} color={color} /> : <X size={13} color={color} />}
      <Text style={{ fontSize: 12, color }}>{label}</Text>
    </View>
  )
}
