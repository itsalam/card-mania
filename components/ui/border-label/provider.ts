import { createContext } from 'react'
import { ColorValue } from 'react-native'
import { DerivedValue } from 'react-native-reanimated'

export type FieldDecoratorStore = {
  label?: string
  accentColor?: DerivedValue<ColorValue>
  opacity?: DerivedValue<number>
  floatOnFocus?: boolean
  forceFloat?: boolean
  onFocus?: () => void
  onBlur?: () => void
}

export const FieldDecoratorContext = createContext<FieldDecoratorStore>({
  label: undefined,
  accentColor: undefined,
  floatOnFocus: false,
  forceFloat: false,
})
