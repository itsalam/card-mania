import {
  Blur,
  Color,
  Group,
  Mask,
  Paint,
  Path,
  Rect,
  RoundedRect,
  Skia,
  Text,
  useFont,
} from '@shopify/react-native-skia'
import { Fragment, useCallback, useMemo, useState } from 'react'
import { Dimensions, View } from 'react-native'
import {
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated'
import { Colors, SegmentedControl } from 'react-native-ui-lib'
import {
  CartesianChart,
  CurveType,
  Line,
  PointsArray,
  useAreaPath,
  useChartPressState,
  useLinePath,
} from 'victory-native'
import { PointValueCard } from './ui/PointValueCard'
import { SeriesDot } from './ui/SeriesDot'
import { GraphInputKey, NumericalFields, PriceGraphProps, SeriesPoint, SeriesSV } from './ui/types'
import { getFontHeight, wrapContent } from './utils'

export const TIME_PERIODS = ['1W', '1M', '3M', '1Y', 'all']
const TIME_PERIODS_DURATION: Record<string, number> = {
  '1W': 1000 * 60 * 60 * 24 * 7,
  '1M': 1000 * 60 * 60 * 24 * 30,
  '3M': 1000 * 60 * 60 * 24 * 90,
  '1Y': 1000 * 60 * 60 * 24 * 365,
}

const getTimeRange = (timePeriod: string): [Date, Date] => {
  const duration = TIME_PERIODS_DURATION[timePeriod]
  const now = new Date()
  const start = new Date(new Date(now.getTime() - duration).setHours(0, 0, 0, 0))

  return [start, now]
}

function buildAreaUnderLinePath(pts: PointsArray, bottomY: number) {
  const p = Skia.Path.Make()
  if (!pts.length) return p

  // Start at the bottom-left corner
  p.moveTo(pts[0].x, bottomY)
  // Up to the first point on the line
  p.lineTo(pts[0].x, pts[0]?.y ?? bottomY)

  // Follow the polyline (if you use a curved path elsewhere, that's fine:
  // this clip only needs to *contain* the area below; polyline is OK.)
  for (let i = 1; i < pts.length; i++) {
    p.lineTo(pts[i].x, pts[i]?.y ?? bottomY)
  }

  // Down to bottom at the last x, then back to bottom-left
  p.lineTo(pts[pts.length - 1].x, bottomY)
  p.close()
  return p
}

const LineEffect = (props: {
  points: PointsArray
  curveType?: CurveType
  connectMissingData?: boolean
  fadePx?: number
  color: Color
  strokeWidth?: number
  y0: number
}) => {
  const {
    points,
    curveType = 'natural',
    connectMissingData = true,
    fadePx = 5,
    color,
    strokeWidth = 10,
    y0,
  } = props
  const { path: linePath } = useLinePath(points, { curveType, connectMissingData })
  const { path: areaPath } = useAreaPath(points, y0, { curveType, connectMissingData })
  return (
    <Group clip={areaPath}>
      <Group
        layer={
          <Paint>
            {/* apply blur to the entire offscreen layer */}
            <Blur blur={fadePx} mode="decal" />
          </Paint>
        }
      >
        <Path path={linePath} style="stroke" strokeWidth={strokeWidth} color={color} />
      </Group>
    </Group>
  )
}

export default function PriceGraph<
  T extends Record<string, YValues>,
  InputKeys extends GraphInputKey<T> = GraphInputKey<T>,
  YValues extends keyof NumericalFields<T> = keyof NumericalFields<T>
>(props: PriceGraphProps<T, InputKeys, YValues>) {
  const { width = Dimensions.get('window').width, height = 350, data, xKey, yKeys } = props
  const initialY = useMemo(
    () => Object.fromEntries(yKeys.map((k) => [k, 0])) as Record<YValues, number>,
    [yKeys]
  )

  const { state, isActive } = useChartPressState<{
    x: number
    y: Record<YValues, number>
  }>({ x: 0 as never, y: initialY })

  const [timePeriod, setTimePeriod] = useState(TIME_PERIODS[0])

  const splitX = useDerivedValue(() => (isActive ? state.x.position.value : width), [isActive])
  const clipRect = useDerivedValue(() => {
    const clipRect = Skia.Path.Make()
    clipRect.addRect(Skia.XYWHRect(0, 0, splitX.value, height)) //
    return clipRect
  }, [splitX])

  return (
    <View className="w-full" style={{ height: height }}>
      <CartesianChart<
        T,
        InputKeys,
        // @ts-ignore
        YValues
      >
        data={data ?? []}
        // @ts-ignore
        chartPressState={state}
        xKey={xKey}
        yKeys={yKeys}
        xAxis={{
          tickCount: 0,
        }}
        domainPadding={{
          right: 140,
          top: 40,
          bottom: 40,
        }}
        yAxis={[
          {
            tickCount: 0,
          },
        ]}
        domain={{ x: getTimeRange(timePeriod).map((date) => date.getTime()) as [number, number] }}
      >
        {({ points, chartBounds, ...rest }) => {
          const lastPoints = yKeys.reduce(
            (acc, yKey) => ({ ...acc, [yKey]: points[yKey][points[yKey].length - 1] }),
            {} as Record<string, PointsArray[number]>
          )
          return (
            <>
              {props.yKeys.map((yKey) => {
                const key = String(yKey)
                const pts = points[yKey] as PointsArray
                return (
                  <Line
                    points={pts}
                    color={Colors.rgba(Colors.$outlinePrimary, 0.1)}
                    strokeWidth={3}
                    curveType="natural"
                    connectMissingData
                    key={`${key}-line-shadow`}
                  />
                )
              })}

              <Mask mask={<Rect x={0} y={0} width={splitX} height={height} color="white" />}>
                {props.yKeys.map((yKey) => {
                  const key = String(yKey)
                  const pts = points[yKey] as PointsArray
                  return (
                    <Line
                      key={`${key}-mask-line`}
                      points={pts}
                      strokeWidth={3}
                      color={Colors.rgba(Colors.$outlinePrimary, 1.0)}
                      curveType="natural"
                    />
                  )
                })}
              </Mask>

              {/* <Mask mask={<Rect x={0} y={0} width={splitX} height={height} color="white" />}> */}
              <Group clip={clipRect}>
                {props.yKeys.map((yKey) => {
                  const key = String(yKey)
                  const pts = points[yKey] as PointsArray
                  return (
                    <LineEffect
                      key={`${key}-effect-mask`}
                      points={pts}
                      curveType="natural"
                      connectMissingData
                      fadePx={20}
                      y0={chartBounds.bottom}
                      strokeWidth={50}
                      color={Colors.rgba(Colors.$outlinePrimary, 0.3) as Color}
                    />
                  )
                })}
              </Group>
              {/* </Mask> */}
              {lastPoints && (
                <ToolTip
                  xValue={state.x.value}
                  restPoints={lastPoints}
                  isActive={isActive}
                  x={state.x.position}
                  yKeys={state.y}
                  bottom={chartBounds.bottom}
                  top={chartBounds.top}
                />
              )}
            </>
          )
        }}
      </CartesianChart>
      <View className="w-full px-12 py-4">
        <SegmentedControl
          segments={TIME_PERIODS.map((period) => ({ label: period }))}
          onChangeIndex={(index) => setTimePeriod(TIME_PERIODS[index])}
        />
      </View>
    </View>
  )
}

export function ToolTip({
  isActive,
  x,
  yKeys, // { [seriesKey]: { value, position } }
  bottom,
  top,
  xValue,
  restPoints, // { [seriesKey]: { x, y } }  (in *pixel* coords)
}: {
  isActive: boolean
  x: SharedValue<number>
  yKeys: Record<string, SeriesSV>
  bottom: number
  top: number
  xValue: SharedValue<number>
  fontSize?: number
  topOffset?: number
  restPoints: Record<string, SeriesPoint>
}) {
  const font = useFont(require('../../assets/fonts/Inter.ttf'), 12)
  const seriesKeys = useMemo(() => Object.keys(yKeys ?? {}), [yKeys])
  if (!seriesKeys.length) return null

  const [xValueText, setXValueText] = useState('')

  const restP = useMemo(() => {
    let mx = -Infinity
    const points = Object.values(restPoints)
    let resultP: SeriesPoint | undefined = points[points.length - 1]
    for (const p of points) {
      if (p?.x && p.x > mx) {
        mx = p.x
        resultP = p
      }
    }
    return resultP
  }, [restPoints])

  // Target X (animates between active crosshair and rest)
  const targetX = useDerivedValue(() => {
    const to = isActive ? x.value : restP?.x ?? 0
    return withTiming(to, { duration: isActive ? 10 : 100 })
  }, [isActive, restP])

  const rectX = useDerivedValue(() => targetX.value - 1)

  // Height for the guide (we’ll draw a thin Rect instead of <Line> to avoid vecs)
  const guideTop = top
  const guideHeight = Math.max(0, bottom - guideTop)

  const formatDateValue = useCallback(
    (v: number) => {
      setXValueText(
        new Date(isActive ? v : String(restP?.xValue)).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      )
    },
    [setXValueText, isActive, restP]
  )

  useAnimatedReaction(
    () => xValue.value,
    (v) => {
      'worklet'
      runOnJS(formatDateValue)(v)
    },
    [xValue, isActive]
  )

  const textWidth = font ? font.measureText(xValueText).width : 0
  const textHeight = getFontHeight(font)
  const { width: cardW, height: cardH, radius } = wrapContent(textWidth, textHeight, {})

  const cardX = useDerivedValue(() => rectX.value - cardW / 2)
  const cardY = useDerivedValue(() => guideTop)
  const lineY = useDerivedValue(() => guideTop + cardH)

  const textY = useDerivedValue(
    () => cardY.value + cardH - textHeight / 2,
    [cardY, cardH, textHeight]
  )
  const textX = useDerivedValue(
    () => cardX.value + cardW / 2 - textWidth / 2,
    [cardX, cardW, textWidth]
  )

  return (
    <>
      {/* Vertical guide only while active. Using Rect lets us pass SharedValues directly. */}
      {
        <>
          <Rect
            x={rectX} // center the 2px guide
            y={lineY}
            width={1}
            height={guideHeight}
            color="rgba(0,0,0,0.3)"
          />
          <RoundedRect
            x={cardX} // left at cx + offset.x, but RoundedRect wants a number
            y={cardY}
            width={cardW}
            height={cardH}
            r={radius}
            color="rgba(0,0,0, 0.3)"
            // shift by offset: supply separate SVs via tiny derived mirrors if you prefer.
          />
          <Text text={xValueText} x={textX} y={textY} font={font} color="white" />
        </>
      }

      {/* Series dots (always shown). Each computes its own Y target with a derived value. */}
      {seriesKeys.map((key) => (
        <Fragment key={key}>
          <SeriesDot
            key={key}
            isActive={isActive}
            x={targetX}
            posY={yKeys[key].position}
            restY={restPoints[key]?.y}
            color={Colors.$outlinePrimary}
          />
          <PointValueCard
            key={key + '-card'}
            isActive={isActive}
            cx={targetX}
            label={key}
            cy={yKeys[key].position}
            valueSV={yKeys[key].value}
            canvasWidth={100}
            canvasTop={10}
            canvasBottom={100}
            restPoint={restPoints[key]}
          />
        </Fragment>
      ))}
    </>
  )
}
