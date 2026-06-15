import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import React, { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import Svg, { Defs, Line, Pattern, Polyline, Rect, Text as SvgText } from 'react-native-svg'
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
const PAD_R = 12
const PAD_T = 12
const PAD_B = 28

export function PriceGraph<
  T extends Record<string, unknown>,
  InputKeys extends keyof any = any,
  YValues extends keyof any = any,
>(props: PriceGraphProps<T, InputKeys, YValues>) {
  const { data, xKey, yKeys, height = 240, colors = [], pending, fetching } = props
  const [period, setPeriod] = useState<Period>('3M')
  const [containerW, setContainerW] = useState(600)

  const chartW = containerW - PAD_L - PAD_R
  const chartH = height - PAD_T - PAD_B

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

    const series = (yKeys as string[]).map((key, i) => {
      const pts = effectiveData
        .map((d, idx) => {
          const yv = (d as Record<string, unknown>)[key]
          if (yv == null || typeof yv !== 'number') return null
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
        rawMinY = rawMinY * 0.9
        rawMaxY = rawMaxY * 1.1 || 1
      }
    }
    return { minY: rawMinY, maxY: rawMaxY, series }
  }, [filtered, renderData, isTransformed, yKeys, colors])

  const toX = (idx: number) =>
    filtered.length <= 1 ? chartW / 2 : (idx / (filtered.length - 1)) * chartW

  const yRange = maxY - minY
  const toY = (v: number) => chartH - ((v - minY) / yRange) * chartH

  const xLabels = useMemo(() => {
    if (filtered.length === 0) return []
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
  }, [filtered, xKey, period, containerW])

  const yLabels = useMemo(() => {
    if (isTransformed && axisBreaks.length > 0) {
      // Place labels at evenly-spaced norm positions, skipping the break zone gap.
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
  }, [isTransformed, axisBreaks, valueDenorm, minY, maxY, yRange])

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

  return (
    <View style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
        {PERIODS.map(({ label }) => {
          const active = period === label
          return (
            <Pressable
              key={label}
              onPress={() => setPeriod(label)}
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

      <View
        style={{ width: '100%', height }}
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
      >
        <Svg width={containerW} height={height}>
          {isTransformed && axisBreaks.length > 0 && (
            <Defs>
              <Pattern
                id="breakHatch"
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
            </Defs>
          )}

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

          {xLabels.map(({ x, label }, i) => (
            <SvgText
              key={i}
              x={PAD_L + x}
              y={PAD_T + chartH + PAD_B - 4}
              textAnchor="middle"
              fontSize={10}
              fill={Colors.$textNeutral ?? '#888'}
            >
              {label}
            </SvgText>
          ))}

          {series.map(({ key, pts, color }) => {
            if (!pts.length) return null
            const points = pts.map((p) => `${PAD_L + toX(p.idx)},${PAD_T + toY(p.yv)}`).join(' ')
            return (
              <Polyline
                key={key as string}
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )
          })}

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
                    fill="url(#breakHatch)"
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
        </Svg>
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
