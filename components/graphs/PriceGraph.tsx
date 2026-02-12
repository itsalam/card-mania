import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
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
  SkPath,
  Text,
  useFont,
} from '@shopify/react-native-skia'
import React, { Fragment, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Dimensions, View } from 'react-native'
import Animated, {
  DerivedValue,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Colors, SegmentedControl } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
import {
  CartesianChart,
  CurveType,
  Line,
  PointsArray,
  useAreaPath,
  useChartPressState,
  useLinePath,
} from 'victory-native'
import { Skeleton } from '../ui/skeleton'
import { PointValueCard } from './ui/PointValueCard'
import { SeriesDot } from './ui/SeriesDot'
import {
  GraphInputKey,
  InputFieldType,
  NumericalFields,
  PriceGraphProps,
  SeriesPoint,
  SeriesSV,
} from './ui/types'
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

export const DateRangeContext = React.createContext<{
  timePeriod: string
  setTimePeriod: (s: string) => void
} | null>(null)

export const ChartPressContext = React.createContext<{
  sharedX: SharedValue<number>
  sharedXValue: SharedValue<number>
  sharedActive: SharedValue<boolean>
  latestX: SharedValue<number>
  latestXValue: SharedValue<number>
  setLatest: (x: number, xv: number) => void
} | null>(null)

const useTimeRange = () => {
  const context = React.useContext(DateRangeContext)
  if (!context) {
    throw new Error('useTimeRange must be used within a DateRangeProvider')
  }
  return context
}

export const ChartPressProvider = ({ children }: { children: React.ReactNode }) => {
  const sharedX = useSharedValue(0)
  const sharedXValue = useSharedValue(0)
  const sharedActive = useSharedValue(false)
  const latestX = useSharedValue(0)
  const latestXValue = useSharedValue(0)
  const setLatest = React.useCallback(
    (x: number, xv: number) => {
      latestX.set(x)
      latestXValue.set(xv)
    },
    [latestX, latestXValue]
  )

  const [activeJs, setActiveJs] = useState(false)

  useAnimatedReaction(
    () => sharedActive.value,
    (v) => {
      'worklet'
      scheduleOnRN(setActiveJs, v)
    },
    [sharedActive]
  )

  useEffect(() => {
    if (activeJs) return
    const t = setTimeout(() => {
      sharedX.set(latestX.value)
      sharedXValue.set(latestXValue.value)
      sharedActive.set(true)
    }, 80)
    return () => clearTimeout(t)
  }, [activeJs, sharedX, sharedXValue, sharedActive, latestX, latestXValue])

  return (
    <ChartPressContext.Provider
      value={{ sharedX, sharedXValue, sharedActive, latestX, latestXValue, setLatest }}
    >
      {children}
    </ChartPressContext.Provider>
  )
}

const useSharedPress = () => {
  const context = React.useContext(ChartPressContext)
  if (!context) {
    throw new Error('useChartPress must be used within a ChartPressProvider')
  }
  return context
}

export function DateRangeProvider({
  children,
  renderChildren,
  isLoading,
}: {
  children?: ReactNode
  renderChildren?: (control: ReactNode) => ReactNode
  isLoading?: boolean
}) {
  const [timePeriod, setTimePeriod] = useState(TIME_PERIODS[0])

  const SegmentControlComponent = !isLoading ? (
    <SegmentedControl
      activeColor={Colors.$iconPrimary}
      segments={TIME_PERIODS.map((period) => ({ label: period }))}
      onChangeIndex={(index) => setTimePeriod(TIME_PERIODS[index])}
    />
  ) : (
    <View className="w-full px-12 py-4">
      <Skeleton style={{ width: '100%', height: 34, borderRadius: 1000 }} />
    </View>
  )

  return (
    <DateRangeContext.Provider value={{ timePeriod, setTimePeriod }}>
      {renderChildren ? (
        renderChildren(SegmentControlComponent)
      ) : (
        <View>
          {children}
          {SegmentControlComponent}
        </View>
      )}
    </DateRangeContext.Provider>
  )
}

export function PriceGraph<
  T extends Record<string, YValues>,
  InputKeys extends GraphInputKey<T> = GraphInputKey<T>,
  YValues extends keyof NumericalFields<T> = keyof NumericalFields<T>,
>(props: PriceGraphProps<T, InputKeys, YValues>) {
  const {
    width = Dimensions.get('window').width,
    height = 450,
    data,
    xKey,
    yKeys,
    color = Colors.$outlinePrimary,
    style,
    showTooltipLabel = true,
  } = props
  const scheme = useEffectiveColorScheme() // 'light' | 'dark' | null
  const { timePeriod } = useTimeRange()
  const isInactive = !Boolean(data)
  const initialY = useMemo(
    () => Object.fromEntries(yKeys.map((k) => [k, 0])) as Record<YValues, number>,
    [yKeys]
  )

  const { state, isActive } = useChartPressState<{
    x: number
    y: Record<YValues, number>
  }>({ x: 0 as never, y: initialY })

  const { sharedX, sharedXValue, sharedActive, setLatest, latestX, latestXValue } = useSharedPress()
  const toNumberX = useCallback((v: any) => {
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      const t = Date.parse(v)
      if (!Number.isNaN(t)) return t
      const n = Number(v)
      if (!Number.isNaN(n)) return n
    }
    return 0
  }, [])
  const [sharedXJs, setSharedXJs] = useState(0)
  const [sharedActiveJs, setSharedActiveJs] = useState(false)

  // When a press ends, snap back to the latest point ("current date")
  useEffect(() => {
    if (isActive) return
    if (!data?.length) return

    sharedX.value = latestX.value
    sharedXValue.value = latestXValue.value
    sharedActive.value = true
  }, [isActive, data, xKey, sharedX, sharedXValue, sharedActive, toNumberX])

  useAnimatedReaction(
    () => sharedX.value,
    (v) => {
      'worklet'
      scheduleOnRN(setSharedXJs, v)
    },
    [sharedX]
  )

  useAnimatedReaction(
    () => sharedActive.value,
    (v) => {
      'worklet'
      scheduleOnRN(setSharedActiveJs, v)
    },
    [sharedActive]
  )

  // keep shared crosshair in sync
  useDerivedValue(() => {
    if (isActive) {
      sharedX.value = state.x.position.value
      // worklet-safe numeric coercion
      const raw = state.x.value as unknown
      const parsed =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string'
            ? (() => {
                'worklet'
                const d = Date.parse(raw as string)
                if (!Number.isNaN(d)) return d
                const n = Number(raw)
                return Number.isNaN(n) ? 0 : n
              })()
            : 0
      sharedXValue.value = parsed
      sharedActive.value = true
    }
  }, [isActive, sharedX, sharedActive, sharedXValue])

  // When another chart is controlling the shared crosshair, mirror its X into this chart's press state
  useDerivedValue(() => {
    if (sharedActive.value && !isActive) {
      state.x.position.value = sharedX.value
      state.x.value = sharedXValue.value
    }
  }, [sharedActive, sharedX, sharedXValue, isActive])

  const splitX = useDerivedValue(() => {
    if (sharedActive.value) return sharedX.value
    if (isActive) return state.x.position.value
    return sharedX.value || width
  }, [sharedActive, sharedX, isActive, width])
  const crosshairX = useDerivedValue(
    () => (sharedActive.value ? sharedX.value : state.x.position.value),
    [sharedActive, sharedX]
  )

  const crosshairXValue = useDerivedValue(
    () => (sharedActive.value ? sharedXValue.value : state.x.value),
    [sharedActive, sharedXValue]
  )
  const clipRect = useDerivedValue(() => {
    const clipRect = Skia.Path.Make()
    clipRect.addRect(Skia.XYWHRect(0, 0, splitX.value, height)) //
    return clipRect
  }, [splitX])

  return (
    <Animated.View key={scheme} className="w-full" style={[style, { height }]}>
      {isInactive ? (
        <LoadingState
          height={height / 2}
          width={width}
          yKeys={yKeys as unknown as string[]}
          clipRect={clipRect}
        />
      ) : (
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
          domain={{
            x: getTimeRange(timePeriod).map((date) => date.getTime()) as [number, number],
          }}
        >
          {({ points, chartBounds, ...rest }) => {
            const primaryPts = points[props.yKeys[0]] as PointsArray | undefined

            const lp = primaryPts?.[primaryPts.length - 1]
            const latestVal = lp?.x
            setLatest(lp?.x ?? 0, latestVal ?? 0)

            const activeX = sharedActiveJs ? sharedXJs : state.x.position.value
            const lastPoints = yKeys.reduce(
              (acc, yKey) => {
                const pts = points[yKey] as PointsArray
                if (!pts?.length) return acc
                const nearest = pts.reduce((best, p) =>
                  Math.abs(p.x - activeX) < Math.abs(best.x - activeX) ? p : best
                )
                acc[yKey] = nearest
                return acc
              },
              {} as Record<string, PointsArray[number]>
            )

            const effectiveIsActiveBool = sharedActiveJs || isActive

            return (
              <>
                {props.yKeys.map((yKey) => {
                  const key = String(yKey)
                  const pts = points[yKey] as PointsArray
                  return (
                    <Line
                      points={pts}
                      color={Colors.rgba(color, 0.1)}
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
                        color={Colors.rgba(color, 1.0)}
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
                        fadePx={15}
                        y0={chartBounds.bottom}
                        strokeWidth={30}
                        color={Colors.rgba(color, 0.3) as Color}
                      />
                    )
                  })}
                </Group>
                {/* </Mask> */}
                {lastPoints && (
                  <ToolTip
                    xValue={crosshairXValue}
                    restPoints={lastPoints}
                    isActive={effectiveIsActiveBool}
                    seriesActive={isActive}
                    x={crosshairX}
                    yKeys={state.y}
                    bottom={chartBounds.bottom}
                    top={chartBounds.top}
                    color={color}
                    showLabel={showTooltipLabel}
                  />
                )}
              </>
            )
          }}
        </CartesianChart>
      )}
    </Animated.View>
  )
}

export default function FullPriceGraph<
  T extends Record<string, YValues>,
  InputKeys extends GraphInputKey<T> = GraphInputKey<T>,
  YValues extends keyof NumericalFields<T> = keyof NumericalFields<T>,
>(props: PriceGraphProps<T, InputKeys, YValues>) {
  const { width = Dimensions.get('window').width, height = 450, data, yKeys } = props
  const isInactive = !Boolean(data)

  return (
    <Animated.View className="w-full" style={{ height: isInactive ? height / 2 : height }}>
      <DateRangeProvider>
        <ChartPressProvider>
          <PriceGraph {...props} />
        </ChartPressProvider>
      </DateRangeProvider>
    </Animated.View>
  )
}

export function ToolTip({
  isActive,
  seriesActive,
  x,
  yKeys, // { [seriesKey]: { value, position } }
  bottom,
  top,
  xValue,
  restPoints, // { [seriesKey]: { x, y } }  (in *pixel* coords)
  color,
  showLabel = true,
}: {
  isActive: boolean
  seriesActive?: boolean
  x: SharedValue<number>
  yKeys: Record<string, SeriesSV>
  bottom: number
  top: number
  xValue: SharedValue<number>
  fontSize?: number
  topOffset?: number
  restPoints: Record<string, SeriesPoint>
  color?: string
  showLabel?: boolean
}) {
  const font = useFont(require('../../assets/fonts/Inter.ttf'), 12)
  const seriesKeys = useMemo(() => Object.keys(yKeys ?? {}), [yKeys])
  if (!seriesKeys.length) return null
  const seriesIsActive = seriesActive ?? isActive

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
    const to = x.value
    return withTiming(to, { duration: isActive ? 10 : 100 })
  }, [isActive, restP])

  const rectX = useDerivedValue(() => targetX.value - 1)

  // Height for the guide (we’ll draw a thin Rect instead of <Line> to avoid vecs)
  const guideTop = top
  const guideHeight = Math.max(0, bottom - guideTop)

  // Debounce date formatting to avoid jitter during drag; only the last call in a burst runs
  const formatDateValue = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined
    return (v: InputFieldType) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        const dateVal = v ?? (restP?.xValue as string)
        const dateLabel = new Date(dateVal).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
        setXValueText(dateLabel)
      }, 10)
    }
  }, [setXValueText, restP?.xValue])

  useAnimatedReaction(
    () => ({ x: xValue.value, rest: restP?.xValue ?? restP?.x ?? 0 }),
    ({ x, rest }) => {
      'worklet'
      scheduleOnRN(formatDateValue, rest)
    },
    [xValue, isActive, restP]
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
          {showLabel && (
            <>
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
          )}
        </>
      }

      {/* Series dots (always shown). Each computes its own Y target with a derived value. */}
      {seriesKeys.map((key) => (
        <Fragment key={key}>
          <SeriesDot
            key={key}
            isActive={seriesIsActive}
            x={targetX}
            posY={yKeys[key].position}
            restY={restPoints[key]?.y}
            color={color as Color}
          />
          <PointValueCard
            key={key + '-card'}
            isActive={seriesIsActive}
            cx={targetX}
            label={key}
            cy={yKeys[key].position}
            valueSV={yKeys[key].value}
            canvasWidth={100}
            canvasTop={10}
            canvasBottom={100}
            restPoint={restPoints[key]}
            valueOverride={(restPoints[key] as any)?.yValue ?? (restPoints[key]?.y as number)}
            textColor={color as string | undefined}
          />
        </Fragment>
      ))}
    </>
  )
}

const LoadingState = ({
  width,
  height,
  yKeys,
  clipRect,
}: {
  width: number
  height: number
  yKeys: string[]
  clipRect: DerivedValue<SkPath>
}) => {
  const pulse = useSharedValue(0.5)
  const maskX = useSharedValue(0)

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true)
    maskX.value = withRepeat(withTiming(width, { duration: 1400 }), -1, false)
  }, [maskX, pulse, width])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }))

  const skeletonData = useMemo(() => {
    const [start, end] = getTimeRange('1M')
    const points = 10
    const step = (end.getTime() - start.getTime()) / (points - 1)
    return Array.from({ length: points }).map((_, idx) => {
      const x = start.getTime() + step * idx
      const base = 80 + idx * 2
      const wobble = Math.sin(idx / 2) * 7
      return yKeys.reduce(
        (acc, key, keyIdx) => ({
          ...acc,
          [key]: base + wobble + keyIdx * 2,
        }),
        { x }
      )
    })
  }, [yKeys])

  return (
    <Animated.View className="w-full px-6" style={[{ height }, animatedStyle]}>
      <CartesianChart
        data={skeletonData}
        xKey="x"
        yKeys={yKeys as any}
        xAxis={{ tickCount: 0 }}
        yAxis={[{ tickCount: 0 }]}
        domainPadding={{ right: 60, top: 20, bottom: 20 }}
      >
        {({ points, chartBounds }) => (
          <>
            {yKeys.map((key) => {
              //@ts-ignore
              const pts = points[key] as PointsArray
              return (
                <Line
                  key={`${key}-skeleton`}
                  points={pts}
                  strokeWidth={3}
                  color={Colors.rgba(Colors.$outlineNeutral, 0.5)}
                  curveType="natural"
                />
              )
            })}
            <Mask mask={<Rect x={maskX} y={0} width={width / 2} height={height} color="white" />}>
              {yKeys.map((key) => {
                //@ts-ignore
                const pts = points[key] as PointsArray
                return (
                  <Line
                    key={`${key}-skeleton-mask`}
                    points={pts}
                    strokeWidth={4}
                    color={Colors.rgba(Colors.$outlineDefault, 1)}
                    curveType="natural"
                  />
                )
              })}
            </Mask>
            <Group clip={clipRect}>
              {yKeys.map((yKey) => {
                const key = String(yKey)
                //@ts-ignore
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
                    color={Colors.rgba(Colors.$outlineDisabled, 1.0) as Color}
                  />
                )
              })}
            </Group>
          </>
        )}
      </CartesianChart>
    </Animated.View>
  )
}
