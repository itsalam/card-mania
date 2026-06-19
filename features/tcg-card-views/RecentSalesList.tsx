import { fmtCardValue } from '@/components/graphs/helpers'
import { formatLabel } from '@/components/utils'
import { Text } from '@/components/ui/text/base-text'
import React, { useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

type Props = {
  priceData: Record<string, string | number>[]
  selectedGrades: string[]
  gradeColors: Record<string, string>
}

function toMs(v: string | number): number {
  return typeof v === 'number' ? v : new Date(v).getTime()
}

function fmtDate(v: string | number): string {
  return new Date(toMs(v)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function RecentSalesList({ priceData, selectedGrades, gradeColors }: Props) {
  const displayGrades = selectedGrades.slice(0, 3)

  const rows = useMemo(
    () =>
      [...priceData]
        .sort((a, b) => toMs(b.date) - toMs(a.date))
        .filter((d) => displayGrades.some((g) => typeof d[g] === 'number'))
        .slice(0, 15),
    [priceData, displayGrades]
  )

  if (!rows.length) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text variant="muted">No price history available.</Text>
      </View>
    )
  }

  const divider = Colors.$outlineNeutral ?? 'rgba(255,255,255,0.08)'

  return (
    <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
      {/* Header row */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: divider,
        }}
      >
        <Text
          style={[styles.dateCol, { color: Colors.$textNeutral, fontSize: 10, fontWeight: '600' }]}
        >
          DATE
        </Text>
        {displayGrades.map((g) => (
          <Text
            key={g}
            style={[
              styles.priceCol,
              {
                color: gradeColors[g] ?? Colors.$textNeutral,
                fontSize: 10,
                fontWeight: '600',
                fontFamily: 'SpaceMono',
              },
            ]}
          >
            {formatLabel(g).toUpperCase()}
          </Text>
        ))}
      </View>

      {rows.map((row, i) => (
        <View
          key={i}
          style={[
            {
              flexDirection: 'row',
              paddingHorizontal: 12,
              paddingVertical: 10,
              alignItems: 'center',
            },
            i % 2 !== 0 && {
              backgroundColor: Colors.rgba(Colors.$backgroundElevated ?? '#fff', 0.04),
            },
          ]}
        >
          <Text style={[styles.dateCol, { color: Colors.$textNeutral, fontSize: 12 }]}>
            {fmtDate(row.date)}
          </Text>
          {displayGrades.map((g) => (
            <Text
              key={g}
              style={[
                styles.priceCol,
                {
                  fontSize: 13,
                  fontWeight: '600',
                  color: typeof row[g] === 'number' ? Colors.$textDefault : Colors.$textNeutral,
                },
              ]}
            >
              {typeof row[g] === 'number' ? fmtCardValue(Number(row[g])) : '—'}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  )
}

const styles = {
  dateCol: { flex: 1.4 } as const,
  priceCol: { flex: 1, textAlign: 'right' as const },
}
