import { Text } from '@/components/ui/text/base-text'
import React, { useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { formatLabel, formatPrice, splitToNChunks } from '@/components/utils'
import { Eye, EyeOff, Plus } from 'lucide-react-native'

export const Prices = ({
  prices,
  visibleGrades,
  setSelectedGrades,
  selectedGrades,
  setShowMoreGrades,
}: {
  prices: [string, any][]
  visibleGrades: string[]
  setSelectedGrades: React.Dispatch<React.SetStateAction<string[]>>
  selectedGrades: string[]
  setShowMoreGrades: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const NUM_PRICE_ROWS = 2
  const rows = useMemo(
    () =>
      splitToNChunks(
        prices.filter(([key]) => visibleGrades.includes(key)),
        NUM_PRICE_ROWS
      ).filter((r) => r.length > 0),
    [prices, visibleGrades]
  )

  return (
    <ScrollView
      horizontal
      bounces={false}
      showsHorizontalScrollIndicator={true}
      alwaysBounceVertical={true}
      className="overflow-visible p-4"
      style={{ alignSelf: 'stretch', maxHeight: 200, flexGrow: 0, flexShrink: 0 }}
      contentContainerClassName="flex gap-2 flex-col"
    >
      {rows.map((row, i) => (
        <View key={`row-${i}`} className={'flex flex-row gap-2 overflow-visible pr-4'}>
          {row.map(([key, value]) => {
            return (
              <LiquidGlassCard
                className="flex items-center justify-center"
                style={{ opacity: value ? 1 : 0.5, minWidth: 100 }}
                size="sm"
                key={`${key}-${value}-${i}`}
                onPress={() => {
                  setSelectedGrades((prev) =>
                    prev.includes(key) ? prev.filter((grade) => grade !== key) : [...prev, key]
                  )
                }}
              >
                <View className="flex flex-row gap-2 items-center justify-end">
                  {selectedGrades.includes(key) ? (
                    <Eye size={16} color={Colors.$iconDefault} />
                  ) : (
                    <EyeOff size={16} color={Colors.$iconDefault} />
                  )}
                  <Text className="text-lg font-bold text-muted-foreground text-nowrap text-right font-spaceMono">
                    {formatLabel(key)}
                  </Text>
                </View>
                <Text className="text-3xl capitalize text-nowrap text-right">
                  {value ? formatPrice(value) : '--'}
                </Text>
              </LiquidGlassCard>
            )
          })}
          {rows.length === i + 1 && (
            <LiquidGlassCard
              className="flex items-center justify-center"
              style={{ aspectRatio: 1 }}
              size="sm"
              onPress={() => setShowMoreGrades((prev) => !prev)}
            >
              <Plus size={28} />
            </LiquidGlassCard>
          )}
        </View>
      ))}
    </ScrollView>
  )
}
