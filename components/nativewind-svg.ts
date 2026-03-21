// e.g. in src/styles/nativewind-svg.ts (import this file once at app start)
import { LinearGradient } from 'expo-linear-gradient'
import { cssInterop } from 'nativewind'
import Svg from 'react-native-svg'

cssInterop(Svg, {
  className: {
    target: 'style',
    nativeStyleToProp: { width: true, height: true },
  },
})

cssInterop(LinearGradient, {
  className: {
    target: 'style',
    nativeStyleToProp: { start: true, end: true },
  },
})
