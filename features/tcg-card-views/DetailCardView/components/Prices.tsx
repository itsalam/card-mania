import { Text } from '@/components/ui/text/base-text'
import React, { useMemo } from 'react'
import { Pressable, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

import { fmtCardValue } from '@/components/graphs/helpers'
import { formatLabel } from '@/components/utils'
import { Eye, EyeOff } from 'lucide-react-native'
import { useGradeColors } from '../GradeColorsProvider'

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
  const gradeColors = useGradeColors()
  const visible = useMemo(
    () => prices.filter(([key]) => visibleGrades.includes(key)),
    [prices, visibleGrades]
  )

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 4,
      }}
    >
      {visible.map(([key, value]) => {
        const isSelected = selectedGrades.includes(key)
        return (
          <Pressable
            key={key}
            onPress={() => {
              setSelectedGrades((prev) =>
                prev.includes(key) ? prev.filter((grade) => grade !== key) : [...prev, key]
              )
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: Colors.$backgroundElevated,
              borderRadius: 8,
              paddingVertical: 6,
              paddingHorizontal: 8,
              opacity: value ? 1 : 0.5,
              borderWidth: 1,
              borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
              borderLeftWidth: 3,
              borderLeftColor: gradeColors[key]
                ? Colors.rgba(gradeColors[key], isSelected ? 1 : 0.25)
                : 'transparent',
            }}
          >
            {isSelected ? (
              <Eye size={11} color={Colors.$iconDefault} />
            ) : (
              <EyeOff size={11} color={Colors.$iconDefault} />
            )}
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                fontFamily: 'SpaceMono',
                color: Colors.$textNeutral,
              }}
            >
              {formatLabel(key)}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.$textDefault }}>
              {value ? fmtCardValue(value) : '--'}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
