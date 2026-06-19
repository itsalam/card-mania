import { fmtCardValue } from '@/components/graphs/helpers'
import { Text } from '@/components/ui/text/base-text'
import React, { useMemo } from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

type Props = {
  priceData: Record<string, string | number>[]
  selectedGrades: string[]
  gradeColors: Record<string, string>
}

function toMs(v: string | number): number {
  return typeof v === 'number' ? v : new Date(v).getTime()
}

export function PriceSummaryBar({ priceData, selectedGrades, gradeColors }: Props) {
  const stats = useMemo(() => {
    if (!priceData.length || !selectedGrades.length) return null

    const sorted = [...priceData].sort((a, b) => toMs(b.date) - toMs(a.date))
    const primaryGrade = selectedGrades[0]

    const lastEntry = sorted.find((d) => typeof d[primaryGrade] === 'number')
    const lastPrice = lastEntry != null ? Number(lastEntry[primaryGrade]) : null
    const lastDate = lastEntry
      ? new Date(toMs(lastEntry.date)).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : null

    const cutoff = Date.now() - 90 * 86_400_000
    const recent = sorted.filter((d) => toMs(d.date) >= cutoff)
    const recentPrices = recent.flatMap((d) =>
      selectedGrades.map((g) => d[g]).filter((v): v is number => typeof v === 'number')
    )

    const priceMin = recentPrices.length ? Math.min(...recentPrices) : null
    const priceMax = recentPrices.length ? Math.max(...recentPrices) : null

    // recent is sorted descending; the oldest entry in the 3M window is last
    const earliestEntry = [...recent].reverse().find((d) => typeof d[primaryGrade] === 'number')
    const earliestPrice = earliestEntry != null ? Number(earliestEntry[primaryGrade]) : null
    const delta =
      lastPrice != null && earliestPrice != null && earliestPrice !== 0
        ? lastPrice - earliestPrice
        : null
    const deltaPct = delta != null && earliestPrice ? (delta / earliestPrice) * 100 : null

    return { lastPrice, lastDate, priceMin, priceMax, primaryGrade, delta, deltaPct }
  }, [priceData, selectedGrades])

  if (!stats) return null

  const primaryColor = gradeColors[stats.primaryGrade]
  const deltaColor =
    stats.delta == null
      ? Colors.$textNeutral
      : stats.delta > 0
        ? (Colors.$textSuccess as string)
        : stats.delta < 0
          ? (Colors.$textDanger as string)
          : Colors.$textNeutral

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: Colors.$backgroundElevated,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
        borderLeftWidth: 3,
        borderLeftColor: primaryColor ?? (Colors.$outlineNeutral as string),
        overflow: 'hidden',
      }}
    >
      {/* Last Sale */}
      <View style={{ flex: 1, padding: 10, gap: 2 }}>
        <Text
          style={{
            fontSize: 11,
            color: Colors.$textNeutral,
            letterSpacing: 0.5,
            fontWeight: '600',
          }}
        >
          LAST SALE
        </Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.$textDefault }}>
          {stats.lastPrice != null ? fmtCardValue(stats.lastPrice) : '—'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {stats.lastDate && (
            <Text style={{ fontSize: 11, color: Colors.$textNeutral }} numberOfLines={1}>
              {stats.lastDate}
            </Text>
          )}
          {stats.delta != null && stats.deltaPct != null && (
            <Text style={{ fontSize: 11, fontWeight: '600', color: deltaColor }} numberOfLines={1}>
              {stats.delta >= 0 ? '+' : '-'}
              {fmtCardValue(Math.abs(stats.delta))} ({stats.deltaPct >= 0 ? '+' : ''}
              {stats.deltaPct.toFixed(1)}%)
            </Text>
          )}
        </View>
      </View>

      <View style={{ width: 1, backgroundColor: Colors.$outlineNeutral, opacity: 0.4 }} />

      {/* 3-Month Range */}
      <View style={{ flex: 1, padding: 10, gap: 2 }}>
        <Text
          style={{
            fontSize: 11,
            color: Colors.$textNeutral,
            letterSpacing: 0.5,
            fontWeight: '600',
          }}
        >
          3M RANGE
        </Text>
        <Text
          style={{ fontSize: 15, fontWeight: '700', color: Colors.$textDefault }}
          numberOfLines={1}
        >
          {stats.priceMin != null && stats.priceMax != null
            ? `${fmtCardValue(stats.priceMin)} – ${fmtCardValue(stats.priceMax)}`
            : '—'}
        </Text>
      </View>
    </View>
  )
}
