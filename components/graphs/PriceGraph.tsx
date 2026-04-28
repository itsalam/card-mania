import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import {
  Color,
  DashPathEffect,
  Group,
  Mask,
  Paint,
  Path,
  Rect,
  Skia,
  Line as SkiaLine,
  Text,
  useFont,
  vec,
} from '@shopify/react-native-skia'
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
import { CartesianChart, Line, PointsArray, Scatter, useChartPressState } from 'victory-native'
import { TIME_PERIODS, TIME_PERIODS_DURATION, WINDOW_WIDTH } from './constants'
import {
  findNearest,
  fmtAxisValue,
  fmtCardValue,
  formatXTick,
  getTimeRange,
  getXTickValues,
  gradientColors,
  parseXValue,
  roundToNiceCents,
  xRawToMs,
} from './helpers'
import { useAxisTransform } from './hooks/useAxisTransform'
import { ChartPressContext, ChartPressProvider, useSharedPress } from './hooks/useChartPress'
import { DateRangeContext, DateRangeProvider, useTimeRange } from './hooks/useDateRange'
import { LineEffect } from './ui/LineEffect'
import { FetchingDot, LoadingState } from './ui/LoadingState'
import { PendingState } from './ui/PendingState'
import { ToolTip } from './ui/ToolTip'
import { GraphInputKey, NumericalFields, PriceGraphProps } from './ui/types'
import { getFontHeight, wrapContent } from './utils'

// Re-export providers and constants for external consumers.
export { ChartPressContext, ChartPressProvider, DateRangeContext, DateRangeProvider, TIME_PERIODS }

export function PriceGraph<
  T extends Record<string, YValues>,
  InputKeys extends GraphInputKey<T> = GraphInputKey<T>,
  YValues extends keyof NumericalFields<T> = keyof NumericalFields<T>,
>(props: PriceGraphProps<T, InputKeys, YValues>) {
  const {
    width = WINDOW_WIDTH,
    height = 450,
    data,
    pending = false,
    fetching = false,
    xKey,
    yKeys,
    color = Colors.$outlinePrimary,
    colors,
    colorRange,
    style,
    showTooltipLabel = true,
  } = props

  const resolvedColors = useMemo(
    () => (colorRange ? gradientColors(colorRange[0], colorRange[1], yKeys.length) : undefined),
    [colorRange, yKeys.length]
  )
  const getSeriesColor = (idx: number) => resolvedColors?.[idx] ?? colors?.[idx] ?? color
  const scheme = useEffectiveColorScheme()
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

  // Fade in whenever yKeys change (CartesianChart remounts on key change).
  const chartOpacity = useSharedValue(1)
  const drawWidth = useSharedValue(0)
  const prevYKeysStr = useRef((yKeys as string[]).join(','))
  useEffect(() => {
    const curr = (yKeys as string[]).join(',')
    if (prevYKeysStr.current !== curr) {
      chartOpacity.value = 0
      chartOpacity.value = withTiming(1, { duration: 200 })
      prevYKeysStr.current = curr
    }
  }, [yKeys])
  const chartAnimStyle = useAnimatedStyle(() => ({ opacity: chartOpacity.value }))

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

  useEffect(() => {
    if (isActive) return
    if (!data?.length) return
    sharedX.set(latestX.value)
    sharedXValue.set(latestXValue.value)
    sharedActive.set(true)
  }, [isActive, data, xKey, timePeriod, sharedX, sharedXValue, sharedActive, toNumberX])

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

  useDerivedValue(() => {
    if (isActive) {
      sharedX.value = state.x.position.value
      sharedXValue.value = parseXValue(state.x.value.value)
      sharedActive.value = true
    }
  }, [isActive, sharedX, sharedActive, sharedXValue])

  useDerivedValue(() => {
    if (sharedActive.value && !isActive) {
      state.x.position.value = sharedX.value
      state.x.value.value = sharedXValue.value
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
    () => (sharedActive.value ? sharedXValue.value : state.x.value.value),
    [sharedActive, sharedXValue]
  )

  const clipPath = useMemo(() => Skia.Path.Make(), [])
  const clipRect = useDerivedValue(() => {
    clipPath.reset()
    clipPath.addRect(Skia.XYWHRect(0, 0, splitX.value, height))
    return clipPath
  }, [splitX])

  const drawClipPath = useMemo(() => Skia.Path.Make(), [])
  const drawClipRect = useDerivedValue(() => {
    drawClipPath.reset()
    drawClipPath.addRect(Skia.XYWHRect(0, 0, drawWidth.value, height))
    return drawClipPath
  }, [drawWidth])

  const xDomain = useMemo<[number, number] | undefined>(() => {
    if (!TIME_PERIODS_DURATION[timePeriod]) return undefined
    return getTimeRange(timePeriod).map((d) => d.getTime()) as [number, number]
  }, [timePeriod])

  const visibleData = useMemo(() => {
    if (!data?.length || !xDomain) return data
    const [xMin, xMax] = xDomain
    return (data as Record<string, unknown>[]).filter((point) => {
      const ms = xRawToMs(point[xKey as string])
      return isFinite(ms) && ms >= xMin && ms <= xMax
    }) as T[]
  }, [data, xDomain, xKey])

  const yDomainFallback = useMemo<[number, number] | undefined>(() => {
    if (!visibleData?.length) return undefined
    const values = (visibleData as Record<string, unknown>[]).flatMap((point) =>
      (yKeys as string[]).flatMap((k) => {
        const v = point[k]
        return typeof v === 'number' && v > 0 ? [v] : []
      })
    )
    if (!values.length) return undefined
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = (max - min) * 0.12
    return [Math.max(0, min - pad), max + pad]
  }, [visibleData, yKeys])

  const {
    renderData,
    renderYDomain,
    axisBreaks,
    valueDenorm,
    valueNorm,
    normClusterRanges,
    clusterDataRanges,
  } = useAxisTransform(visibleData, yKeys)
  const yDomain = renderYDomain ?? yDomainFallback
  const needsZeroBreak = axisBreaks.length === 0 && (yDomain?.[0] ?? 0) > 0

  const visibleXMin = useMemo(() => {
    if (!visibleData?.length || !xDomain) return xDomain?.[0]
    const xMs = (visibleData as Record<string, unknown>[])
      .map((d) => {
        const ms = xRawToMs(d[xKey as string])
        const snapped = new Date(ms)
        snapped.setHours(0, 0, 0, 0)
        return snapped.getTime()
      })
      .filter((v) => isFinite(v) && v > 0)
    return xMs.length ? Math.min(...xMs) : xDomain[0]
  }, [visibleData, xDomain, xKey])

  const xTickValues = useMemo(() => {
    if (!data?.length) return undefined
    if (xDomain) {
      return getXTickValues(visibleXMin ?? xDomain[0], xDomain[1], timePeriod)
    }
    const xMs = (data as Record<string, unknown>[])
      .map((d) => xRawToMs(d[xKey as string]))
      .filter((v) => isFinite(v) && v > 0)
    if (xMs.length < 2) return undefined
    return getXTickValues(xMs[0], xMs[xMs.length - 1], timePeriod)
  }, [data, xKey, xDomain, timePeriod, visibleXMin])

  const yTickValues = useMemo(() => {
    if (!normClusterRanges?.length) return undefined
    const raw = [
      0,
      ...normClusterRanges.flatMap(([lo, hi], i) =>
        i === 0 ? [lo + (hi - lo) * 0.8] : [lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.8]
      ),
    ]
    const mapped = raw.map((tv) => {
      if (tv === 0) return 0
      const clusterIdx = normClusterRanges.findIndex(
        ([lo, hi]) => tv >= lo - 0.001 && tv <= hi + 0.001
      )
      const rounded = roundToNiceCents(valueDenorm(tv))
      if (clusterIdx < 0 || !clusterDataRanges?.[clusterIdx]) return valueNorm(Math.max(rounded, 1))
      const [dataMin, dataMax] = clusterDataRanges[clusterIdx]
      return valueNorm(Math.max(dataMin + 1, Math.min(rounded, dataMax - 1)))
    })
    return [...new Set(mapped)]
  }, [normClusterRanges, clusterDataRanges, valueDenorm, valueNorm])

  // Convert ISO string x values → ms numbers so Victory Native treats data as
  // isNumericalData=true, enabling domain.x, tickValues, and formatXLabel.
  const chartData = useMemo(() => {
    const source = (renderData ?? data ?? []) as Record<string, unknown>[]
    if (!source.length) return source
    return source.map((d) => {
      const ms = xRawToMs(d[xKey as string])
      const snapped = new Date(ms)
      snapped.setHours(0, 0, 0, 0)
      return {
        ...d,
        [xKey as string]: snapped.getTime(),
      }
    }) as T[]
  }, [renderData, data, xKey])

  const hasValidData = useMemo(
    () =>
      chartData.length > 0 &&
      (chartData as Record<string, unknown>[]).some((point) =>
        (yKeys as string[]).some((k) => typeof point[k] === 'number')
      ),
    [chartData, yKeys]
  )

  const prevTimePeriodRef = useRef(timePeriod)
  useEffect(() => {
    if (timePeriod === prevTimePeriodRef.current) return
    prevTimePeriodRef.current = timePeriod
    if (!hasValidData) return
    chartOpacity.value = withSequence(
      withTiming(0, { duration: 120 }),
      withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) })
    )
  }, [timePeriod, hasValidData])

  const hasDrawAnimatedRef = useRef(false)
  const prevDrawAnimKeyRef = useRef('')
  useEffect(() => {
    const animKey = (yKeys as string[]).join(',')
    if (animKey !== prevDrawAnimKeyRef.current) {
      prevDrawAnimKeyRef.current = animKey
      hasDrawAnimatedRef.current = false
    }
    if (hasValidData && !hasDrawAnimatedRef.current) {
      drawWidth.value = 0
      drawWidth.value = withTiming(width * 1.1, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      })
      hasDrawAnimatedRef.current = true
    }
  }, [hasValidData, yKeys])

  const axisFont = useFont(require('../../assets/fonts/Inter.ttf'), 11)
  // Same fonts PointValueCard uses — needed to measure card width for domainPadding.right
  const cardPriceFont = useFont(require('../../assets/fonts/SpaceMono-Regular.ttf'), 12)
  const cardLabelFont = useFont(require('../../assets/fonts/SpaceMono-Regular.ttf'), 10)

  const yLabelPad = useMemo(() => {
    if (!yTickValues || !axisFont) return 0
    const maxW = Math.max(
      0,
      ...yTickValues.map((tv) => {
        const real = axisBreaks.length ? valueDenorm(tv) : tv
        return axisFont.measureText(fmtAxisValue(real)).width
      })
    )
    return Math.ceil(maxW) + 2
  }, [yTickValues, axisFont, axisBreaks, valueDenorm])

  // domainPadding.right large enough to fully show the PointValueCard for the rightmost point.
  // Card width mirrors PointValueCard: wrapContent(max(priceW, labelW), ..., { padX: 8 })
  // plus the default card offset of 8px from the dot.
  const cardRightPad = useMemo(() => {
    if (!cardPriceFont || !cardLabelFont) return 100
    const allValues = (visibleData ?? []) as Record<string, unknown>[]
    let maxCents = 0
    for (const point of allValues) {
      for (const k of yKeys as string[]) {
        const v = point[k]
        if (typeof v === 'number' && v > maxCents) maxCents = v
      }
    }
    const priceStr = fmtCardValue(maxCents)
    const priceW = cardPriceFont.measureText(priceStr).width
    const labelW = Math.max(
      0,
      ...(yKeys as string[]).map((k) => cardLabelFont.measureText(k.replace(/_price$/, '')).width)
    )
    const { width: cardW } = wrapContent(Math.max(priceW, labelW), 0, { padX: 8 })
    const DOT_RADIUS = 4
    const CARD_OFFSET_X = 8 // PointValueCard default offset.x
    return Math.ceil(cardW) + DOT_RADIUS + CARD_OFFSET_X
  }, [cardPriceFont, cardLabelFont, visibleData, yKeys, timePeriod])

  return (
    <Animated.View key={scheme} className="w-full" style={[style, { height, overflow: 'visible' }]}>
      {isInactive || !hasValidData ? (
        pending ? (
          <PendingState height={height} width={width} yKeys={yKeys as unknown as string[]} />
        ) : (
          <LoadingState height={height} width={width} yKeys={yKeys as unknown as string[]} />
        )
      ) : (
        <Animated.View style={[{ flex: 1 }, chartAnimStyle]}>
          <CartesianChart<
            T,
            InputKeys,
            // @ts-ignore
            YValues
          >
            key={(yKeys as string[]).join(',')}
            data={chartData as T[]}
            // @ts-ignore
            chartPressState={state}
            xKey={xKey}
            yKeys={yKeys}
            xAxis={{
              tickValues: xTickValues,
              formatXLabel: (v) => formatXTick(v, timePeriod),
              labelColor: 'rgba(255,255,255,0.35)',
              lineColor: 'transparent',
              font: axisFont,
              labelOffset: -14,
              // labelPosition: 'inset',
            }}
            padding={{
              ...(yLabelPad ? { left: yLabelPad } : undefined),
              // bottom: 16,

              // bottom: needsZeroBreak ? 24 : 12,
            }}
            domainPadding={{
              top: 40,
              left: 4,
              bottom: 1,
              right: cardRightPad,
            }}
            yAxis={[
              yTickValues
                ? {
                    tickValues: yTickValues,
                    lineColor: 'transparent',
                    labelOffset: 0,
                  }
                : {
                    tickCount: 4,
                    lineColor: 'rgba(255,255,255,0.2)',
                    linePathEffect: <DashPathEffect intervals={[6, 3]} />,
                    labelColor: 'rgba(255,255,255,0.3)',
                    font: axisFont,
                    labelOffset: 4,
                    formatYLabel: (v: string | number) => {
                      const n = Number(v)
                      if (n < 0) return ''
                      return fmtAxisValue(n)
                    },
                  },
            ]}
            renderOutside={({ chartBounds, yScale, xScale, xTicks }) => {
              const lh = axisFont ? getFontHeight(axisFont) : 0
              return (
                <>
                  {yTickValues &&
                    axisFont &&
                    yTickValues.map((tv, idx) => {
                      const py = yScale(tv)
                      const real = axisBreaks.length ? valueDenorm(tv) : tv
                      const label = fmtAxisValue(real)
                      const lw = axisFont.measureText(label).width
                      const labelX = chartBounds.left - lw - 2
                      const labelY = py + lh / 2
                      return (
                        <Text
                          key={`ylabel-${idx}`}
                          text={label}
                          x={labelX}
                          y={labelY}
                          font={axisFont}
                          color="rgba(255,255,255,0.3)"
                        />
                      )
                    })}
                  {xTicks.map((tick) => {
                    const px = xScale(tick)
                    if (px < chartBounds.left || px > chartBounds.right) return null
                    return (
                      <SkiaLine
                        key={`x-notch-${tick}`}
                        p1={vec(px, chartBounds.bottom - 20)}
                        p2={vec(px, chartBounds.bottom - 15)}
                        color="rgba(255,255,255,0.35)"
                        strokeWidth={1.5}
                      />
                    )
                  })}
                </>
              )
            }}
            domain={
              xDomain || yDomain
                ? {
                    ...(xDomain
                      ? {
                          x: [Math.max(visibleXMin ?? xDomain[0], 0), xDomain[1]] as [
                            number,
                            number,
                          ],
                        }
                      : {}),
                    ...(yDomain ? { y: yDomain } : {}),
                  }
                : undefined
            }
          >
            {({ points, chartBounds, yScale, xScale }) => {
              const primaryPts = points[props.yKeys[0]] as PointsArray | undefined

              const lp = primaryPts?.[primaryPts.length - 1]
              if (lp?.x) {
                const lpX = lp.x
                const lpXValue = (lp.xValue as number) ?? 0
                setLatest(lpX, lpXValue)
                if (sharedX.value === 0) {
                  sharedX.set(lpX)
                  sharedXValue.set(lpXValue)
                  sharedActive.set(true)
                }
              }

              const activeX = sharedActiveJs ? sharedXJs : state.x.position.value
              const lastPoints = yKeys.reduce(
                (acc, yKey) => {
                  const pts = points[yKey] as PointsArray
                  if (!pts?.length) return acc
                  const nearest = findNearest(pts, activeX, true)
                  if (nearest) acc[yKey as keyof typeof acc] = nearest
                  return acc
                },
                {} as Record<string, PointsArray[number]>
              )

              const effectiveIsActiveBool = sharedActiveJs || isActive

              // --- Compressed-zone detection (pixel-space) ---
              const CLUSTER_THRESH_PX = 28
              const ZONE_PAD = 14
              type SRange = { minY: number; maxY: number; midY: number }
              const seriesRanges: SRange[] = (yKeys as string[])
                .map((yKey) => {
                  const pts = (points[yKey as keyof typeof points] as PointsArray)?.filter(
                    (p) => p.y != null && p.y > 0
                  )
                  if (!pts?.length) return null
                  const ys = pts.map((p) => p.y!)
                  const minY = Math.min(...ys)
                  const maxY = Math.max(...ys)
                  return { minY, maxY, midY: (minY + maxY) / 2 }
                })
                .filter(Boolean) as SRange[]
              seriesRanges.sort((a, b) => a.midY - b.midY)
              const compressedZones: { top: number; bottom: number }[] = []
              let zi = 0
              while (zi < seriesRanges.length) {
                let groupMin = seriesRanges[zi].minY
                let groupMax = seriesRanges[zi].maxY
                let zj = zi + 1
                while (
                  zj < seriesRanges.length &&
                  seriesRanges[zj].midY - seriesRanges[zi].midY < CLUSTER_THRESH_PX
                ) {
                  groupMin = Math.min(groupMin, seriesRanges[zj].minY)
                  groupMax = Math.max(groupMax, seriesRanges[zj].maxY)
                  zj++
                }
                if (zj > zi + 1) compressedZones.push({ top: groupMin, bottom: groupMax })
                zi = zj
              }

              // --- Broken-axis pixel positions ---
              type BreakGap = { topPx: number; bottomPx: number; label: string }
              const breakGaps: BreakGap[] = axisBreaks.map((b) => ({
                topPx: yScale(b.normHigh),
                bottomPx: yScale(b.normLow),
                label: b.label,
              }))

              const zoneWidth = chartBounds.right - chartBounds.left

              return (
                <>
                  {/* Custom y-axis grid lines (normalised mode only). */}
                  {yTickValues?.map((tv, idx) => {
                    const py = yScale(tv)
                    if (tv === 0) {
                      return (
                        <Rect
                          key={`gridline-${idx}`}
                          x={chartBounds.left}
                          y={py - 0.5}
                          width={zoneWidth}
                          height={1}
                          color="rgba(255,255,255,0.10)"
                        />
                      )
                    }
                    const p = Skia.Path.Make()
                    p.moveTo(chartBounds.left, py)
                    p.lineTo(chartBounds.right, py)
                    return (
                      <Path
                        key={`gridline-${idx}`}
                        path={p}
                        style="stroke"
                        strokeWidth={1}
                        color="rgba(255,255,255,0.2)"
                      >
                        <DashPathEffect intervals={[4, 6]} />
                      </Path>
                    )
                  })}

                  {/* Broken-axis zones — hatched band where the y-axis jumps non-linearly */}
                  {breakGaps.map((gap, idx) => {
                    const gapH = Math.max(0, gap.bottomPx - gap.topPx)
                    if (gapH < 4) return null
                    const hatchPath = Skia.Path.Make()
                    const hSpacing = 10
                    for (let ox = -gapH; ox <= zoneWidth + gapH; ox += hSpacing) {
                      hatchPath.moveTo(chartBounds.left + ox, gap.topPx)
                      hatchPath.lineTo(chartBounds.left + ox + gapH, gap.bottomPx)
                    }
                    const clipR = Skia.XYWHRect(chartBounds.left, gap.topPx, zoneWidth, gapH)
                    const labelText = gap.label
                    const labelW = axisFont?.measureText(labelText)?.width ?? 0
                    const labelX = chartBounds.left + zoneWidth / 2 - labelW / 2
                    const labelY = gap.topPx + gapH / 2 + 4
                    return (
                      <Group key={`bgap-${idx}`} clip={clipR}>
                        <Rect
                          x={chartBounds.left}
                          y={gap.topPx}
                          width={zoneWidth}
                          height={gapH}
                          color="rgba(10,10,14,0.9)"
                        />
                        <Path path={hatchPath}>
                          <Paint style="stroke" strokeWidth={1} color="rgba(255,255,255,0.1)" />
                        </Path>
                        <Rect
                          x={chartBounds.left}
                          y={gap.topPx}
                          width={zoneWidth}
                          height={1}
                          color="rgba(255,255,255,0.25)"
                        />
                        <Rect
                          x={chartBounds.left}
                          y={gap.bottomPx - 1}
                          width={zoneWidth}
                          height={1}
                          color="rgba(255,255,255,0.25)"
                        />
                        {axisFont && (
                          <Text
                            x={labelX}
                            y={labelY}
                            text={labelText}
                            font={axisFont}
                            color="rgba(255,255,255,0.35)"
                          />
                        )}
                      </Group>
                    )
                  })}

                  {/* Compressed-zone highlight bands
                  {axisBreaks.length === 0 &&
                    compressedZones.map((zone, idx) => {
                      const zoneY = zone.top - ZONE_PAD
                      const zoneH = zone.bottom - zone.top + ZONE_PAD * 2
                      return (
                        <Fragment key={`czone-${idx}`}>
                          <RoundedRect
                            x={chartBounds.left}
                            y={zoneY}
                            width={zoneWidth}
                            height={zoneH}
                            r={6}
                            color="transparent"
                          >
                            <Paint style="stroke" strokeWidth={1} color="rgba(255,255,255,0.1)" />
                          </RoundedRect>
                        </Fragment>
                      )
                    })} */}

                  {/* Zero break zone — shown when chart bottom is above $0 */}
                  {needsZeroBreak &&
                    (() => {
                      const ZERO_BREAK_H = 20
                      const breakY = chartBounds.bottom + 2
                      const breakLabel = `$0 — ${fmtAxisValue(yDomain![0])}`
                      const labelW = axisFont?.measureText(breakLabel)?.width ?? 0
                      const labelX = chartBounds.left + zoneWidth / 2 - labelW / 2
                      const labelY = breakY + ZERO_BREAK_H / 2 + 4
                      const clipR = Skia.XYWHRect(chartBounds.left, breakY, zoneWidth, ZERO_BREAK_H)
                      const hatchPath = Skia.Path.Make()
                      for (let ox = -ZERO_BREAK_H; ox <= zoneWidth + ZERO_BREAK_H; ox += 10) {
                        hatchPath.moveTo(chartBounds.left + ox, breakY)
                        hatchPath.lineTo(
                          chartBounds.left + ox + ZERO_BREAK_H,
                          breakY + ZERO_BREAK_H
                        )
                      }
                      return (
                        <Group key="zero-break" clip={clipR}>
                          <Rect
                            x={chartBounds.left}
                            y={breakY}
                            width={zoneWidth}
                            height={ZERO_BREAK_H}
                            color="rgba(10,10,14,0.9)"
                          />
                          <Path path={hatchPath}>
                            <Paint style="stroke" strokeWidth={1} color="rgba(255,255,255,0.1)" />
                          </Path>
                          <Rect
                            x={chartBounds.left}
                            y={breakY}
                            width={zoneWidth}
                            height={1}
                            color="rgba(255,255,255,0.25)"
                          />
                          {axisFont && (
                            <Text
                              x={labelX}
                              y={labelY}
                              text={breakLabel}
                              font={axisFont}
                              color="rgba(255,255,255,0.35)"
                            />
                          )}
                        </Group>
                      )
                    })()}

                  <Group clip={drawClipRect}>
                    {/* Shadow lines (dim, always visible) */}
                    {props.yKeys.map((yKey, i) => {
                      const key = String(yKey)
                      const pts = points[yKey] as PointsArray
                      const seriesColor = getSeriesColor(i)
                      const pastPoints = pts.filter((p) => activeX - (p.x ?? 0) > 0)
                      return (
                        <Fragment key={`${key}-dots`}>
                          <Line
                            points={pts}
                            color={Colors.rgba(seriesColor, 0.1)}
                            strokeWidth={3}
                            curveType="monotoneX"
                            connectMissingData
                            key={`${key}-line-shadow`}
                          />
                          <Scatter
                            points={pastPoints}
                            radius={3}
                            color={Colors.rgba(seriesColor, 0.7)}
                          />
                          <Scatter points={pts} radius={3} color={Colors.rgba(seriesColor, 0.4)} />
                        </Fragment>
                      )
                    })}

                    {/* Masked lines (full colour only on the left side of the crosshair) */}
                    <Mask mask={<Rect x={0} y={0} width={splitX} height={height} color="white" />}>
                      {props.yKeys.map((yKey, i) => {
                        const key = String(yKey)
                        const pts = points[yKey] as PointsArray
                        return (
                          <Line
                            key={`${key}-mask-line`}
                            points={pts}
                            strokeWidth={3}
                            color={Colors.rgba(getSeriesColor(i), 1.0)}
                            curveType="monotoneX"
                            connectMissingData
                          />
                        )
                      })}
                    </Mask>

                    {/* Glow/area effect */}
                    <Group clip={clipRect}>
                      {props.yKeys.map((yKey, i) => {
                        const key = String(yKey)
                        const pts = points[yKey] as PointsArray
                        return (
                          <LineEffect
                            key={`${key}-effect-mask`}
                            points={pts}
                            curveType="monotoneX"
                            connectMissingData
                            y0={yScale(0)}
                            topY={chartBounds.top}
                            color={Colors.rgba(getSeriesColor(i), 0.5) as Color}
                          />
                        )
                      })}
                    </Group>

                    {/* Flat extrapolation lines for series that don't reach the domain end */}
                    {props.yKeys.map((yKey, i) => {
                      const key = String(yKey)
                      const pts = (points[yKey] as PointsArray)?.filter(
                        (p) => p.x != null && p.y != null
                      )
                      if (!pts?.length) return null
                      const lastPt = pts[pts.length - 1]
                      if (!lastPt.x || !lastPt.y) return null
                      const endPx = xDomain ? xScale(xDomain[1]) : chartBounds.right
                      if (lastPt.x >= endPx - 2) return null
                      const p = Skia.Path.Make()
                      p.moveTo(lastPt.x, lastPt.y)
                      p.lineTo(endPx, lastPt.y)
                      return (
                        <Path
                          key={`${key}-extrap`}
                          path={p}
                          style="stroke"
                          strokeWidth={2}
                          color={Colors.rgba(getSeriesColor(i), 0.3)}
                        >
                          <DashPathEffect intervals={[4, 5]} />
                        </Path>
                      )
                    })}

                    {/* Flat extrapolation lines for series that don't reach the domain start */}
                    {(() => {
                      // The global earliest x across all series — if a series starts here,
                      // we've hit the edge of our historical data (dashed); otherwise solid.
                      const globalFirstX = Math.min(
                        ...(props.yKeys as string[]).flatMap((yKey) => {
                          const pts = (points[yKey] as PointsArray)?.filter(
                            (p) => p.x != null && p.y != null
                          )
                          return pts?.length ? [pts[0].x!] : []
                        })
                      )
                      return props.yKeys.map((yKey, i) => {
                        const key = String(yKey)
                        const pts = (points[yKey] as PointsArray)?.filter(
                          (p) => p.x != null && p.y != null
                        )
                        if (!pts?.length) return null
                        const firstPt = pts[0]
                        if (!firstPt.x || !firstPt.y) return null
                        const startPx = xDomain ? xScale(xDomain[0]) : chartBounds.left
                        if (firstPt.x <= startPx + 2) return null
                        const p = Skia.Path.Make()
                        p.moveTo(startPx, firstPt.y)
                        p.lineTo(firstPt.x, firstPt.y)
                        // Dashed only if this series starts at the earliest historical point.
                        const atHistoricalEdge = Math.abs(firstPt.x - globalFirstX) < 3
                        return atHistoricalEdge ? (
                          <Path
                            key={`${key}-extrap-start`}
                            path={p}
                            style="stroke"
                            strokeWidth={2}
                            color={Colors.rgba(getSeriesColor(i), 0.3)}
                          >
                            <DashPathEffect intervals={[4, 5]} />
                          </Path>
                        ) : (
                          <Path
                            key={`${key}-extrap-start`}
                            path={p}
                            style="stroke"
                            strokeWidth={2}
                            color={Colors.rgba(getSeriesColor(i), 0.5)}
                          />
                        )
                      })
                    })()}
                  </Group>

                  {lastPoints && Object.keys(state.y).length && (
                    <ToolTip
                      xValue={crosshairXValue}
                      restPoints={lastPoints}
                      isActive={effectiveIsActiveBool}
                      seriesActive={isActive}
                      x={crosshairX}
                      yKeys={state.y}
                      bottom={chartBounds.bottom}
                      top={chartBounds.top}
                      left={chartBounds.left}
                      right={chartBounds.right}
                      color={color}
                      colors={resolvedColors ?? colors}
                      valueDenorm={axisBreaks.length ? valueDenorm : undefined}
                      showLabel={showTooltipLabel}
                      breakGaps={breakGaps}
                      lastDataXPerSeries={(() => {
                        const m: Record<string, number> = {}
                        for (const yKey of props.yKeys as string[]) {
                          const pts = (points[yKey] as PointsArray)?.filter(
                            (p) => p.x != null && p.y != null
                          )
                          const last = pts?.[pts.length - 1]
                          if (last?.x) m[yKey] = last.x
                        }
                        return m
                      })()}
                    />
                  )}
                </>
              )
            }}
          </CartesianChart>
          {fetching && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                alignItems: 'center',
                paddingBottom: 8,
              }}
            >
              <View
                style={{
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <FetchingDot />
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 12,
                    fontFamily: 'SpaceMono',
                  }}
                >
                  Fetching price history…
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  )
}

export default function FullPriceGraph<
  T extends Record<string, YValues>,
  InputKeys extends GraphInputKey<T> = GraphInputKey<T>,
  YValues extends keyof NumericalFields<T> = keyof NumericalFields<T>,
>(props: PriceGraphProps<T, InputKeys, YValues>) {
  const { width = WINDOW_WIDTH, height = 450, data } = props
  const isInactive = !Boolean(data)

  return (
    <Animated.View className="w-full" style={{ height: isInactive ? height / 4 : height }}>
      <DateRangeProvider>
        <ChartPressProvider>
          <PriceGraph {...props} />
        </ChartPressProvider>
      </DateRangeProvider>
    </Animated.View>
  )
}
