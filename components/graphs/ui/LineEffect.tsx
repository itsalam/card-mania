import { Blur, Color, Group, Paint, Path } from '@shopify/react-native-skia'
import { CurveType, PointsArray, useAreaPath, useLinePath } from 'victory-native'

type LineEffectProps = {
  points: PointsArray
  curveType?: CurveType
  connectMissingData?: boolean
  fadePx?: number
  color: Color
  strokeWidth?: number
  y0: number
}

export const LineEffect = ({
  points,
  curveType = 'natural',
  connectMissingData = true,
  fadePx = 10,
  color,
  strokeWidth = 10,
  y0,
}: LineEffectProps) => {
  const { path: linePath } = useLinePath(points, { curveType, connectMissingData })
  // y0 is already offset by fadePx at the call site so the blur fades out
  // exactly at the intended boundary without the path needing to overshoot.
  const { path: areaPath } = useAreaPath(points, y0, { curveType, connectMissingData })
  return (
    <Group clip={areaPath}>
      <Group
        layer={
          <Paint>
            <Blur blur={fadePx} mode="repeat" />
          </Paint>
        }
      >
        <Path path={linePath} style="stroke" strokeWidth={24} color={color} />
      </Group>
    </Group>
  )
}
