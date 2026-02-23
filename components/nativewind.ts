// e.g. in src/styles/nativewind-svg.ts (import this file once at app start)
import { LinearGradient } from 'expo-linear-gradient'
import { cssInterop } from 'nativewind'
import Svg, { Circle, Rect } from 'react-native-svg'

cssInterop(Svg, {
  className: {
    target: 'style',
    nativeStyleToProp: { width: true, height: true },
  },
})
cssInterop(Circle, {
  className: {
    target: 'style',
    nativeStyleToProp: { width: true, height: true, stroke: true, strokeWidth: true, fill: true },
  },
})
cssInterop(Rect, {
  className: {
    target: 'style',
    nativeStyleToProp: { width: true, height: true, stroke: true, strokeWidth: true, fill: true },
  },
})

cssInterop(LinearGradient, {
  className: {
    target: 'style',
    nativeStyleToProp: { colors: true, start: true, end: true },
  },
})
