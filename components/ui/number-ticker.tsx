import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { cssInterop } from 'nativewind'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import {
  BorderRadiuses,
  Colors,
  NumberInput,
  TextField,
  TextFieldProps,
  TouchableOpacity,
} from 'react-native-ui-lib'

cssInterop(NumberInput, {
  className: {
    //@ts-ignore
    target: 'style',
  },
})

type NumberTickerProps = TextFieldProps & {
  disabled?: boolean
  className?: string
  fractionDigits?: number
  onChangeNumber?: (value: number) => void
  initialNumber?: number
  min?: number
  max?: number
}

export const NumberTicker = ({
  className,
  containerStyle,
  style,
  fractionDigits,
  initialNumber,
  onChangeNumber,
  margin,
  min,
  max,
  ...props
}: NumberTickerProps) => {
  const [number, setNumber] = useState(initialNumber || 0)
  fractionDigits = fractionDigits ?? 0
  useEffect(() => {
    onChangeNumber && onChangeNumber(number)
  }, [number])

  const onChangeText = (str: string) => {
    let num = Number(Number(str).toFixed(fractionDigits))
    if (isNaN(num)) {
      setNumber(number)
      return
    }
    if (min !== undefined) {
      num = Math.max(num, min)
    }
    if (max !== undefined) {
      num = Math.min(num, max)
    }
    setNumber(num)
  }

  return (
    <View
      style={{
        position: 'relative',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className={className}
    >
      <TouchableOpacity
        onPress={() => setNumber(Math.min(number + 1, max || Infinity))}
        style={{ marginBottom: 4 }}
        hitSlop={{ top: 10, bottom: 0, left: 10, right: 10 }}
      >
        <ChevronUp size={24} />
      </TouchableOpacity>
      <TextField
        {...props}
        containerStyle={[
          containerStyle,
          {
            borderWidth: 2,
            borderColor: Colors.$outlineDefault,
            borderRadius: BorderRadiuses.br20,
            minWidth: 44,
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
        style={[
          style,
          {
            fontSize: 20,
          },
        ]}
        onChangeText={onChangeText}
        value={String(number)}
        keyboardType="numeric"
        centered
      />
      <TouchableOpacity
        onPress={() => setNumber(Math.max(number - 1, min || -Infinity))}
        style={{ marginTop: 4 }}
        hitSlop={{ top: 0, bottom: 10, left: 10, right: 10 }}
      >
        <ChevronDown size={24} />
      </TouchableOpacity>
    </View>
  )
}
