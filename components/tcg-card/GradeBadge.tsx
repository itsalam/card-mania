import { Text } from '@/components/ui/text/base-text'
import { formatLabel } from '@/components/utils'
import { gradePriceKey, splitGradeKey } from '@/supabase/functions/_shared/grade-key'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export { gradePriceKey }

/**
 * Splits a price_key into grader + grade (any spelling the SQL `public.normalize_grade_key`
 * accepts). An unrecognised key is shown as its label with no grade.
 */
export function parseGrade(
  priceKey?: string | null
): { company: string; grade: string } | 'raw' | null {
  if (!priceKey) return null
  return splitGradeKey(priceKey) ?? { company: formatLabel(priceKey), grade: '' }
}

/**
 * Slab-style grade label for card art: "PSA | 10" with the grade emphasised, or a muted "RAW"
 * for ungraded copies. Renders nothing when the grade is unknown (e.g. card-level views like
 * Recently Viewed, which aren't tied to a specific copy).
 */
export function GradeBadge({ priceKey }: { priceKey?: string | null }) {
  const parsed = parseGrade(priceKey)
  if (!parsed) return null

  const isRaw = parsed === 'raw'
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isRaw
          ? Colors.rgba(Colors.$outlineNeutral, 0.6)
          : Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.5),
        backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.9),
      }}
    >
      <Text
        variant="stats"
        style={{
          fontSize: 10,
          lineHeight: 13,
          paddingHorizontal: 6,
          paddingVertical: 2,
          color: isRaw ? Colors.$textNeutral : Colors.$textDefault,
        }}
      >
        {isRaw ? 'RAW' : parsed.company}
      </Text>
      {!isRaw && parsed.grade !== '' && (
        <Text
          variant="stats"
          style={{
            fontSize: 10,
            lineHeight: 13,
            fontWeight: '700',
            paddingHorizontal: 6,
            paddingVertical: 2,
            color: Colors.$textDefault,
            backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35),
          }}
        >
          {parsed.grade}
        </Text>
      )}
    </View>
  )
}
