import { Text } from '@/components/ui/text/base-text'
import { formatLabel } from '@/components/utils'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

/**
 * Builds the canonical price key for a grader slug + grade value — the client twin of SQL
 * `public.grade_key` (10 → "psa10", 9.5 → "bgs9_5"); "ungraded" when either is missing.
 */
export function gradePriceKey(slug?: string | null, gradeValue?: number | null): string {
  if (!slug || gradeValue == null) return 'ungraded'
  const grade = Number.isInteger(gradeValue)
    ? String(gradeValue)
    : String(gradeValue).replace('.', '_')
  return `${slug.toLowerCase()}${grade}`
}

/**
 * Splits a price_key into grader + grade. Keys are canonical "psa10" / "bgs9_5" / "ungraded"
 * (SQL `public.grade_key`); legacy spellings ("bgs9.5", "psa10.0") are still accepted.
 */
export function parseGrade(
  priceKey?: string | null
): { company: string; grade: string } | 'raw' | null {
  if (!priceKey) return null
  if (priceKey === 'ungraded') return 'raw'
  const match = priceKey.match(/^([a-z]+)[_ ]?(\d+(?:[._]\d+)?)$/i)
  if (!match) return { company: formatLabel(priceKey), grade: '' }
  // grade_value is numeric, so whole grades arrive as "5.0" — show "5", keep "9.5".
  const grade = match[2].replace('_', '.').replace(/\.0+$/, '')
  return { company: match[1].toUpperCase(), grade }
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
