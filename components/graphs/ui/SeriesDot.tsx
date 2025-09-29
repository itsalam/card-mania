import { Circle, Color } from '@shopify/react-native-skia'
import { SharedValue, useDerivedValue, withTiming } from 'react-native-reanimated'
import { MaybeNumber } from 'victory-native'

export function SeriesDot({
  isActive,
  x,
  posY, // SharedValue<number> from chartPress for this series
  restY, // number | undefined (pixel y when inactive)
  color,
}: {
  isActive: boolean
  x: SharedValue<number>
  posY: SharedValue<number>
  restY?: MaybeNumber
  color: Color
}) {
  // hooks are at component top level — OK
  const cy = useDerivedValue(() => {
    // fall back to current posY if restY is missing to avoid undefined/NaN
    const to = isActive
      ? posY.value
      : Number.isFinite(restY as number)
      ? (restY as number)
      : posY.value
    return withTiming(to, { duration: 10 })
  }, [isActive, restY])

  return <Circle cx={x} cy={cy} r={4} color={color} />
}
