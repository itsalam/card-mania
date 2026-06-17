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
const PAD_R = 16
const PAD_T = 16
const PAD_B = 28
const Y_PAD_FRAC = 0.12

export function PriceGraph<
  T extends Record<string, unknown>,
  InputKeys extends keyof any = any,
  YValues extends keyof any = any,
>(props: PriceGraphProps<T, InputKeys, YValues>) {
  const { data, xKey, yKeys, height: heightProp, colors = [], pending, fetching } = props
  const [period, setPeriod] = useState<Period>('3M')
  const [containerW, setContainerW] = useState(600)
  const [crosshairPx, setCrosshairPx] = useState<number | null>(null)
  // Animated crosshair x: lerps toward the snapped data-point x each RAF frame
  const [animCrosshairX, setAnimCrosshairX] = useState<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const animXRef = useRef<number | null>(null)
  const opacityAnim = useRef(new Animated.Value(1)).current
  const isFirstRender = useRef(true)
  const prevYKeysRef = useRef(yKeys)

  // Derive height from container width when no explicit height is given (fills allotted space)
  const height = heightProp ?? Math.round(containerW * (9 / 16))

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

  const toTimestamp = (v: unknown): number =>
    typeof v === 'number' ? v : new Date(v as string).getTime()

  const filtered = useMemo(() => {
    if (!data?.length) return []
    const sel = PERIODS.find((p) => p.label === period)
    const sorted = [...data].sort(
      (a, b) => toTimestamp(a[xKey as string]) - toTimestamp(b[xKey as string])
    )
    if (!sel?.days) return sorted
    const cutoff = Date.now() - sel.days * 86_400_000
    return sorted.filter((d) => toTimestamp(d[xKey as string]) >= cutoff)
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
      rawMinY = Math.max(0, rawMinY - pad)
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

  // Nearest data-point index under the mouse
  const crosshairIdx = useMemo(() => {
    if (crosshairPx === null || filtered.length === 0 || chartW <= 0) return null
    if (filtered.length === 1) return 0
    const idx = Math.round(Math.max(0, Math.min(1, crosshairPx / chartW)) * (filtered.length - 1))
    return isFinite(idx) && idx >= 0 && idx < filtered.length ? idx : null
  }, [crosshairPx, chartW, filtered.length])

  // The SVG x that corresponds to the snapped data point
  const snappedSvgX = crosshairIdx !== null ? PAD_L + toX(crosshairIdx) : null

  // RAF lerp: animCrosshairX glides toward snappedSvgX each frame (≈35% per frame)
  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)

    if (snappedSvgX === null) {
      animXRef.current = null
      setAnimCrosshairX(null)
      return
    }

    // First appearance: jump immediately so there's no initial drift
    if (animXRef.current === null) {
      animXRef.current = snappedSvgX
      setAnimCrosshairX(snappedSvgX)
      return
    }

    const target = snappedSvgX
    const tick = () => {
      const curr = animXRef.current
      if (curr === null) return
      const diff = target - curr
      if (Math.abs(diff) < 0.4) {
        animXRef.current = target
        setAnimCrosshairX(target)
        return
      }
      animXRef.current = curr + diff * 0.35
      setAnimCrosshairX(animXRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [snappedSvgX])

  // Per-series y info at crosshair
  const crosshairYs = useMemo(() => {
    if (crosshairIdx === null)
      return {} as Record<string, { rawVal: number; ypx: number; isExtrap: boolean }>
    const effectiveData = isTransformed ? (renderData ?? filtered) : filtered
    const result: Record<string, { rawVal: number; ypx: number; isExtrap: boolean }> = {}
    for (const { key, pts } of series) {
      const firstPt = pts[0]
      const lastPt = pts[pts.length - 1]
      const exactRaw = (effectiveData[crosshairIdx] as Record<string, unknown>)?.[key]
      const hasExact = typeof exactRaw === 'number' && isFinite(exactRaw)
      // Left-extrapolated: cursor is before the series' first data point
      const isLeftExtrap = !!firstPt && crosshairIdx < firstPt.idx
      // Right-extrapolated: cursor is after the series' last data point
      const isRightExtrap = !lastPt || (!hasExact && crosshairIdx > (lastPt?.idx ?? -1))
      const isExtrap = isLeftExtrap || isRightExtrap
      // Extend flat from the nearest boundary point rather than defaulting to last
      const yv = hasExact ? (exactRaw as number) : isLeftExtrap ? firstPt?.yv : lastPt?.yv
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
  const crosshairDate =
    crosshairIdx !== null && filtered[crosshairIdx]
      ? fmtDateShort(filtered[crosshairIdx][xKey as string] as any)
      : null
  const maxIdx = filtered.length - 1

  return (
    <View style={{ width: '100%' }}>
      {/* Period selector */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            gap: 2,
            padding: 3,
            backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
            borderWidth: 1,
            borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
            borderRadius: 999,
            alignSelf: 'flex-start',
          }}
        >
          {PERIODS.map(({ label }) => {
            const active = period === label
            return (
              <Pressable
                key={label}
                onPress={() => handlePeriodChange(label)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: active
                    ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35)
                    : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: active ? Colors.$textDefault : Colors.$textNeutral,
                    fontWeight: active ? '700' : '500',
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>
        {fetching && (
          <Text variant="small" style={{ color: Colors.$textNeutral, alignSelf: 'center' }}>
            …
          </Text>
        )}
      </View>

      {/* Chart container */}
      <View
        style={{ width: '100%', height, position: 'relative' }}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width
          if (w > 0) setContainerW(w)
        }}
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
              {/*
               * Per-series area gradients.
               * objectBoundingBox makes each gradient span the polygon's own
               * vertical extent (top of the line → chart bottom), so low-value
               * series that sit near the chart bottom still get visible fill.
               */}
              {series.map(({ key, color }) => (
                <LinearGradient
                  key={key as string}
                  id={`wgrad_${key as string}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                  gradientUnits="objectBoundingBox"
                >
                  <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
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

              {/* Clip rect — uses animCrosshairX so the highlight region glides */}
              {isHovering && animCrosshairX !== null && (
                <ClipPath id="wLeftOfCrosshair">
                  <Rect
                    x={PAD_L}
                    y={PAD_T}
                    width={Math.max(0, animCrosshairX - PAD_L)}
                    height={chartH}
                  />
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
                fontSize={12}
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
                  fontSize={12}
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

            {/* Full-color lines clipped to left of animated crosshair */}
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
                  key={`extrap_right_${key as string}`}
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

            {/* Extrapolation lines — dashed flat from domain start to first point */}
            {series.map(({ key, pts, color }) => {
              if (!pts.length) return null
              const firstPt = pts[0]
              if (firstPt.idx <= 0) return null
              return (
                <Line
                  key={`extrap_left_${key as string}`}
                  x1={PAD_L + toX(0)}
                  y1={PAD_T + toY(firstPt.yv)}
                  x2={PAD_L + toX(firstPt.idx)}
                  y2={PAD_T + toY(firstPt.yv)}
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
                      fontSize={11}
                      fill={Colors.$textNeutral ?? '#888'}
                    >
                      {b.label}
                    </SvgText>
                  </React.Fragment>
                )
              })}

            {/* Crosshair vertical guide — follows animCrosshairX */}
            {isHovering && animCrosshairX !== null && (
              <Line
                x1={animCrosshairX}
                y1={PAD_T}
                x2={animCrosshairX}
                y2={PAD_T + chartH}
                stroke={Colors.$outlineNeutral ?? '#888'}
                strokeWidth={1}
                opacity={0.6}
              />
            )}

            {/* Date badge — snapped position (crosshairIdx data), visual x from anim */}
            {isHovering && animCrosshairX !== null && crosshairDate && (
              <>
                <Rect
                  x={animCrosshairX - 28}
                  y={PAD_T - 2}
                  width={56}
                  height={14}
                  rx={4}
                  fill={Colors.$outlineNeutral ?? '#666'}
                />
                <SvgText
                  x={animCrosshairX}
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
              animCrosshairX !== null &&
              series.map(({ key, color }) => {
                const sy = crosshairYs[key as string]
                if (!sy) return null
                return (
                  <Circle
                    key={`dot_${key as string}`}
                    cx={animCrosshairX}
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

        {/* Value cards — positioned at animCrosshairX right of crosshair */}
        {isHovering &&
          animCrosshairX !== null &&
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
                  left: animCrosshairX + 8,
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
                <Text style={{ color: Colors.$textNeutral, fontSize: 11, lineHeight: 14 }}>
                  {label}
                </Text>
                <Text style={{ color, fontSize: 13, lineHeight: 17, fontWeight: '700' }}>
                  {fmtPrice(sy.rawVal)}
                </Text>
              </View>
            )
          })}

        {/* Transparent pointer event overlay over the chart data area */}
        <View
          style={{ position: 'absolute', left: PAD_L, top: PAD_T, width: chartW, height: chartH }}
          // @ts-ignore — web-only pointer events not in RN types
          onMouseMove={(e: any) => {
            // DOM MouseEvent uses offsetX; locationX is a React Native touch-only property
            const x = e.nativeEvent.offsetX ?? e.nativeEvent.locationX
            if (isFinite(x)) setCrosshairPx(Math.max(0, Math.min(chartW, x)))
          }}
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
