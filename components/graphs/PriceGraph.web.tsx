import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, View } from 'react-native'
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Line,
  LinearGradient,
  Pattern,
  Polygon,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg'
import { Colors } from 'react-native-ui-lib'
import { useAxisTransform } from './hooks/useAxisTransform'
import { PriceGraphProps } from './ui/types'

type Period = '1W' | '1M' | '3M' | '1Y' | 'All'

const PERIODS: { label: Period; days: number | null }[] = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1Y', days: 365 },
  { label: 'All', days: null },
]

function fmtPrice(cents: number): string {
  const d = cents / 100
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}k`
  return `$${d.toFixed(0)}`
}

function fmtDateShort(v: string | number): string {
  const t = typeof v === 'number' ? v : new Date(v).getTime()
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const PAD_L = 48
const PAD_R = 120 // wide enough for tooltip cards
const PAD_T = 16
const PAD_B = 28
const Y_PAD_FRAC = 0.12

export function PriceGraph<
  T extends Record<string, unknown>,
  InputKeys extends keyof any = any,
  YValues extends keyof any = any,
>(props: PriceGraphProps<T, InputKeys, YValues>) {
  const { data, xKey, yKeys, height = 240, colors = [], pending, fetching } = props
  const [period, setPeriod] = useState<Period>('3M')
  const [containerW, setContainerW] = useState(600)
  const [crosshairPx, setCrosshairPx] = useState<number | null>(null)
  const opacityAnim = useRef(new Animated.Value(1)).current
  const isFirstRender = useRef(true)
  const prevYKeysRef = useRef(yKeys)

  const chartW = containerW - PAD_L - PAD_R
  const chartH = height - PAD_T - PAD_B

  // Fade on yKeys change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (JSON.stringify(prevYKeysRef.current) === JSON.stringify(yKeys)) return
    prevYKeysRef.current = yKeys
    Animated.sequence([
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start()
  }, [yKeys, opacityAnim])

  const handlePeriodChange = (newPeriod: Period) => {
    if (newPeriod === period) return
    setCrosshairPx(null)
    Animated.timing(opacityAnim, { toValue: 0, duration: 120, useNativeDriver: false }).start(
      () => {
        setPeriod(newPeriod)
        Animated.timing(opacityAnim, { toValue: 1, duration: 280, useNativeDriver: false }).start()
      }
    )
  }

  const filtered = useMemo(() => {
    if (!data?.length) return []
    const sel = PERIODS.find((p) => p.label === period)
    if (!sel?.days) return data
    const cutoff = Date.now() - sel.days * 86_400_000
    return data.filter((d) => {
      const v = d[xKey as string]
      const t = typeof v === 'number' ? v : new Date(v as string).getTime()
      return t >= cutoff
    })
  }, [data, period, xKey])

  const { renderData, renderYDomain, axisBreaks, valueDenorm } = useAxisTransform(
    filtered as any,
    yKeys as any
  )
  const isTransformed = Boolean(renderYDomain)

  const { minY, maxY, series } = useMemo(() => {
    const effectiveData = isTransformed ? (renderData ?? filtered) : filtered
    if (!effectiveData.length) return { minY: 0, maxY: 1, series: [] }

    let rawMinY = isTransformed ? 0 : Infinity
    let rawMaxY = isTransformed ? 1 : -Infinity

    const seriesArr = (yKeys as string[]).map((key, i) => {
      const pts = effectiveData
        .map((d, idx) => {
          const yv = (d as Record<string, unknown>)[key]
          if (yv == null || typeof yv !== 'number' || !isFinite(yv)) return null
          if (!isTransformed) {
            if (yv < rawMinY) rawMinY = yv
            if (yv > rawMaxY) rawMaxY = yv
          }
          return { idx, yv }
        })
        .filter((p): p is { idx: number; yv: number } => p !== null)
      return { key, pts, color: colors[i] ?? '#6366f1' }
    })

    if (!isTransformed) {
      if (!isFinite(rawMinY)) {
        rawMinY = 0
        rawMaxY = 1
      }
      if (rawMinY === rawMaxY) {
        rawMinY -= 0.1
        rawMaxY += 0.1
      }
      const pad = (rawMaxY - rawMinY) * Y_PAD_FRAC
      rawMinY -= pad
      rawMaxY += pad
    }
    return { minY: rawMinY, maxY: rawMaxY, series: seriesArr }
  }, [filtered, renderData, isTransformed, yKeys, colors])

  const toX = useMemo(
    () => (idx: number) =>
      filtered.length <= 1 ? chartW / 2 : (idx / (filtered.length - 1)) * chartW,
    [filtered.length, chartW]
  )

  const yRange = maxY - minY
  const toY = useMemo(
    () => (v: number) => (yRange === 0 ? chartH / 2 : chartH - ((v - minY) / yRange) * chartH),
    [minY, yRange, chartH]
  )

  const crosshairIdx = useMemo(() => {
    if (crosshairPx === null || filtered.length === 0 || chartW <= 0) return null
    if (filtered.length === 1) return 0
    const idx = Math.round(Math.max(0, Math.min(1, crosshairPx / chartW)) * (filtered.length - 1))
    return isFinite(idx) && idx >= 0 && idx < filtered.length ? idx : null
  }, [crosshairPx, chartW, filtered.length])

  // Per-series y info at crosshair
  const crosshairYs = useMemo(() => {
    if (crosshairIdx === null)
      return {} as Record<string, { rawVal: number; ypx: number; isExtrap: boolean }>
    const effectiveData = isTransformed ? (renderData ?? filtered) : filtered
    const result: Record<string, { rawVal: number; ypx: number; isExtrap: boolean }> = {}
    for (const { key, pts } of series) {
      const lastPt = pts[pts.length - 1]
      const exactRaw = (effectiveData[crosshairIdx] as Record<string, unknown>)?.[key]
      const hasExact = typeof exactRaw === 'number' && isFinite(exactRaw)
      const isExtrap = !lastPt || (!hasExact && crosshairIdx > (lastPt?.idx ?? -1))
      const yv = hasExact ? (exactRaw as number) : lastPt?.yv
      if (yv === undefined) continue
      result[key] = { rawVal: valueDenorm(yv), ypx: toY(yv), isExtrap }
    }
    return result
  }, [crosshairIdx, series, filtered, renderData, isTransformed, valueDenorm, toY])

  // Collision-resolved y positions for value cards
  const resolvedCardYs = useMemo(() => {
    const entries = Object.entries(crosshairYs)
    if (!entries.length) return {} as Record<string, number>
    const CARD_H = 36
    const STEP = CARD_H + 4
    const sorted = [...entries].sort((a, b) => a[1].ypx - b[1].ypx)
    const positions = sorted.map(([, v]) => v.ypx)
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] - positions[i - 1] < STEP) positions[i] = positions[i - 1] + STEP
    }
    for (let i = positions.length - 1; i >= 0; i--) {
      positions[i] = Math.min(positions[i], chartH - CARD_H)
      if (i > 0 && positions[i] - positions[i - 1] < STEP) positions[i - 1] = positions[i] - STEP
    }
    for (let i = 0; i < positions.length; i++) positions[i] = Math.max(0, positions[i])
    const result: Record<string, number> = {}
    sorted.forEach(([key], i) => {
      result[key] = positions[i]
    })
    return result
  }, [crosshairYs, chartH])

  const xLabels = useMemo(() => {
    if (!filtered.length) return []
    const count = Math.min(5, filtered.length)
    const indices =
      count === 1
        ? [0]
        : Array.from({ length: count }, (_, i) =>
            Math.round((i / (count - 1)) * (filtered.length - 1))
          )
    return indices.map((idx) => ({
      x: toX(idx),
      label: fmtDateShort(filtered[idx][xKey as string] as any),
    }))
  }, [filtered, xKey, toX])

  const yLabels = useMemo(() => {
    if (isTransformed && axisBreaks.length > 0) {
      const candidates = [0, 0.15, 0.3, 0.4, 0.6, 0.75, 0.9, 1.0]
      return candidates
        .filter((n) => !axisBreaks.some((b) => n > b.normLow - 0.01 && n < b.normHigh + 0.01))
        .map((n) => ({ y: toY(n), label: fmtPrice(valueDenorm(n)) }))
    }
    const count = 4
    return Array.from({ length: count }, (_, i) => {
      const v = minY + (i / (count - 1)) * yRange
      return { y: toY(v), label: fmtPrice(v) }
    })
  }, [isTransformed, axisBreaks, valueDenorm, minY, yRange, toY])

  if (pending) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text variant="muted">Fetching price data…</Text>
      </View>
    )
  }

  if (!data?.length) {
    return (
      <View style={{ height }}>
        <Skeleton style={{ width: '100%', height }} />
      </View>
    )
  }

  const isHovering = crosshairPx !== null
  const crosshairSvgX = isHovering ? PAD_L + crosshairPx! : null
  const crosshairDate =
    crosshairIdx !== null && filtered[crosshairIdx]
      ? fmtDateShort(filtered[crosshairIdx][xKey as string] as any)
      : null
  const maxIdx = filtered.length - 1

  return (
    <View style={{ width: '100%' }}>
      {/* Period selector */}
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
        {PERIODS.map(({ label }) => {
          const active = period === label
          return (
            <Pressable
              key={label}
              onPress={() => handlePeriodChange(label)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: active
                  ? (Colors.$backgroundPrimaryLight ?? '#3B82F6')
                  : 'transparent',
              }}
            >
              <Text
                variant="small"
                style={{
                  color: active ? '#fff' : Colors.$textNeutral,
                  fontWeight: active ? '600' : '400',
                }}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
        {fetching && (
          <Text variant="small" style={{ color: Colors.$textNeutral, alignSelf: 'center' }}>
            …
          </Text>
        )}
      </View>

      {/* Chart container */}
      <View
        style={{ width: '100%', height, position: 'relative' }}
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
      >
        {/* SVG layer — fades on period/series change */}
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            opacity: opacityAnim,
          }}
          pointerEvents="none"
        >
          <Svg width={containerW} height={height}>
            <Defs>
              {/* Per-series area gradients */}
              {series.map(({ key, color }) => (
                <LinearGradient
                  key={key as string}
                  id={`wgrad_${key as string}`}
                  x1="0"
                  y1={PAD_T}
                  x2="0"
                  y2={PAD_T + chartH}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <Stop offset="100%" stopColor={color} stopOpacity={0} />
                </LinearGradient>
              ))}

              {/* Axis break hatch */}
              {isTransformed && axisBreaks.length > 0 && (
                <Pattern
                  id="wBreakHatch"
                  x="0"
                  y="0"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <Line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                    stroke={Colors.$backgroundNeutral ?? '#444'}
                    strokeWidth="2"
                  />
                </Pattern>
              )}

              {/* Clip left of crosshair for highlighted lines */}
              {isHovering && crosshairSvgX !== null && (
                <ClipPath id="wLeftOfCrosshair">
                  <Rect x={PAD_L} y={PAD_T} width={crosshairSvgX - PAD_L} height={chartH} />
                </ClipPath>
              )}
            </Defs>

            {/* Horizontal grid lines */}
            {yLabels.map(({ y }, i) => (
              <Line
                key={i}
                x1={PAD_L}
                y1={PAD_T + y}
                x2={PAD_L + chartW}
                y2={PAD_T + y}
                stroke={Colors.$outlineNeutral ?? '#444'}
                strokeWidth={0.5}
                strokeDasharray={isTransformed ? '4 4' : undefined}
                opacity={0.35}
              />
            ))}

            {/* Y-axis labels */}
            {yLabels.map(({ y, label }, i) => (
              <SvgText
                key={i}
                x={PAD_L - 6}
                y={PAD_T + y + 4}
                textAnchor="end"
                fontSize={10}
                fill={Colors.$textNeutral ?? '#888'}
              >
                {label}
              </SvgText>
            ))}

            {/* X-axis notch ticks + date labels */}
            {xLabels.map(({ x, label }, i) => (
              <React.Fragment key={i}>
                <Line
                  x1={PAD_L + x}
                  y1={PAD_T + chartH}
                  x2={PAD_L + x}
                  y2={PAD_T + chartH + 4}
                  stroke={Colors.$outlineNeutral ?? '#666'}
                  strokeWidth={1}
                  opacity={0.45}
                />
                <SvgText
                  x={PAD_L + x}
                  y={PAD_T + chartH + PAD_B - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill={Colors.$textNeutral ?? '#888'}
                >
                  {label}
                </SvgText>
              </React.Fragment>
            ))}

            {/* Area fills */}
            {series.map(({ key, pts }) => {
              if (!pts.length) return null
              const areaPoints = [
                `${PAD_L + toX(pts[0].idx)},${PAD_T + chartH}`,
                ...pts.map((p) => `${PAD_L + toX(p.idx)},${PAD_T + toY(p.yv)}`),
                `${PAD_L + toX(pts[pts.length - 1].idx)},${PAD_T + chartH}`,
              ].join(' ')
              return (
                <Polygon
                  key={`area_${key as string}`}
                  points={areaPoints}
                  fill={`url(#wgrad_${key as string})`}
                />
              )
            })}

            {/* Shadow lines — dim when crosshair active */}
            {series.map(({ key, pts, color }) => {
              if (!pts.length) return null
              const points = pts.map((p) => `${PAD_L + toX(p.idx)},${PAD_T + toY(p.yv)}`).join(' ')
              return (
                <Polyline
                  key={`shadow_${key as string}`}
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeOpacity={isHovering ? 0.18 : 1}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )
            })}

            {/* Full-color lines clipped to left of crosshair */}
            {isHovering &&
              series.map(({ key, pts, color }) => {
                if (!pts.length) return null
                const points = pts
                  .map((p) => `${PAD_L + toX(p.idx)},${PAD_T + toY(p.yv)}`)
                  .join(' ')
                return (
                  <Polyline
                    key={`clip_${key as string}`}
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    clipPath="url(#wLeftOfCrosshair)"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )
              })}

            {/* Extrapolation lines — dashed flat from last point to domain end */}
            {series.map(({ key, pts, color }) => {
              if (!pts.length) return null
              const lastPt = pts[pts.length - 1]
              if (lastPt.idx >= maxIdx) return null
              return (
                <Line
                  key={`extrap_${key as string}`}
                  x1={PAD_L + toX(lastPt.idx)}
                  y1={PAD_T + toY(lastPt.yv)}
                  x2={PAD_L + toX(maxIdx)}
                  y2={PAD_T + toY(lastPt.yv)}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  opacity={isHovering ? 0.18 : 0.5}
                />
              )
            })}

            {/* Axis break hatching + label */}
            {isTransformed &&
              axisBreaks.map((b, i) => {
                const top = PAD_T + toY(b.normHigh)
                const bot = PAD_T + toY(b.normLow)
                const mid = (top + bot) / 2
                return (
                  <React.Fragment key={i}>
                    <Rect
                      x={PAD_L}
                      y={top}
                      width={chartW}
                      height={bot - top}
                      fill="url(#wBreakHatch)"
                      opacity={0.35}
                    />
                    <SvgText
                      x={PAD_L + chartW / 2}
                      y={mid + 4}
                      textAnchor="middle"
                      fontSize={9}
                      fill={Colors.$textNeutral ?? '#888'}
                    >
                      {b.label}
                    </SvgText>
                  </React.Fragment>
                )
              })}

            {/* Crosshair vertical guide */}
            {isHovering && crosshairSvgX !== null && (
              <Line
                x1={crosshairSvgX}
                y1={PAD_T}
                x2={crosshairSvgX}
                y2={PAD_T + chartH}
                stroke={Colors.$outlineNeutral ?? '#888'}
                strokeWidth={1}
                opacity={0.6}
              />
            )}

            {/* Date badge at top of crosshair */}
            {isHovering && crosshairSvgX !== null && crosshairDate && (
              <>
                <Rect
                  x={crosshairSvgX - 28}
                  y={PAD_T - 2}
                  width={56}
                  height={14}
                  rx={4}
                  fill={Colors.$outlineNeutral ?? '#666'}
                />
                <SvgText
                  x={crosshairSvgX}
                  y={PAD_T + 9}
                  textAnchor="middle"
                  fontSize={9}
                  fill="white"
                >
                  {crosshairDate}
                </SvgText>
              </>
            )}

            {/* Dots at series y positions on crosshair */}
            {isHovering &&
              crosshairSvgX !== null &&
              series.map(({ key, color }) => {
                const sy = crosshairYs[key as string]
                if (!sy) return null
                return (
                  <Circle
                    key={`dot_${key as string}`}
                    cx={crosshairSvgX}
                    cy={PAD_T + sy.ypx}
                    r={4}
                    fill={color}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                )
              })}
          </Svg>
        </Animated.View>

        {/* Value cards — React Views positioned right of crosshair */}
        {isHovering &&
          crosshairSvgX !== null &&
          series.map(({ key, color }) => {
            const sy = crosshairYs[key as string]
            const cardY = resolvedCardYs[key as string]
            if (!sy || cardY === undefined) return null
            const label = (key as string).replace(/_price$/, '').replace(/_/g, ' ')
            return (
              <View
                key={`card_${key as string}`}
                style={{
                  position: 'absolute',
                  left: crosshairSvgX + 8,
                  top: PAD_T + cardY,
                  backgroundColor: Colors.$backgroundElevatedLight ?? 'rgba(24,24,28,0.92)',
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: Colors.rgba(color, 0.5),
                  minWidth: 72,
                }}
              >
                <Text
                  variant="small"
                  style={{ color: Colors.$textNeutral, fontSize: 9, lineHeight: 13 }}
                >
                  {label}
                </Text>
                <Text
                  variant="default"
                  style={{ color, fontSize: 12, lineHeight: 16, fontWeight: '700' }}
                >
                  {fmtPrice(sy.rawVal)}
                </Text>
              </View>
            )
          })}

        {/* Transparent pointer event overlay over the chart data area */}
        <View
          style={{ position: 'absolute', left: PAD_L, top: PAD_T, width: chartW, height: chartH }}
          // @ts-ignore — web-only pointer events not in RN types
          onMouseMove={(e: any) =>
            setCrosshairPx(Math.max(0, Math.min(chartW, e.nativeEvent.locationX)))
          }
          // @ts-ignore
          onMouseLeave={() => setCrosshairPx(null)}
        />
      </View>
    </View>
  )
}

export default function FullPriceGraph<
  T extends Record<string, unknown>,
  InputKeys extends keyof any = any,
  YValues extends keyof any = any,
>(props: PriceGraphProps<T, InputKeys, YValues>) {
  return <PriceGraph {...props} />
}
