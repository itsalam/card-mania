import { Text } from '@/components/ui/text/base-text'
import { useEffect, useRef } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

const CODE_LENGTH = 6

type OtpInputProps = {
  value: string
  onChange: (v: string) => void
  onComplete: (v: string) => void
}

export function OtpInput({ value, onChange, onComplete }: OtpInputProps) {
  const ref = useRef<TextInput>(null)

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [])

  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}
    >
      {Array.from({ length: CODE_LENGTH }, (_, i) => {
        const char = value[i]
        const isActive = i === value.length
        return (
          <View
            key={i}
            style={{
              width: 44,
              height: 54,
              borderRadius: 10,
              backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
              borderWidth: 1.5,
              borderColor: isActive
                ? Colors.$textPrimary
                : char
                  ? 'rgba(255,255,255,0.35)'
                  : 'rgba(255,255,255,0.15)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 22, fontWeight: '600' }}>{char ?? ''}</Text>
          </View>
        )
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, CODE_LENGTH)
          onChange(digits)
          if (digits.length === CODE_LENGTH) onComplete(digits)
        }}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        caretHidden
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
      />
    </Pressable>
  )
}
