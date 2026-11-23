// Run: deno test supabase/functions/_shared/grade-key.test.ts
// Same case table as supabase/tests/grade_key_normalization.sql — keep the two in sync.
import { assertEquals } from 'jsr:@std/assert@1'
import {
  canonicalGradeKey,
  canonicalGradesPrices,
  gradePriceKey,
  splitGradeKey,
} from './grade-key.ts'

const CASES: [string, string][] = [
  ['psa10', 'psa10'],
  ['psa_10', 'psa10'],
  ['PSA 10', 'psa10'],
  ['psa10.0', 'psa10'],
  ['bgs9.5', 'bgs9_5'],
  ['bgs_9.5', 'bgs9_5'],
  ['bgs9_5', 'bgs9_5'],
  ['BGS 9.5', 'bgs9_5'],
  ['Raw', 'ungraded'],
  ['ungraded', 'ungraded'],
  ['cgc 10', 'cgc10'],
  ['sgc9_0', 'sgc9'],
  ['weird key', 'weird key'],
]

Deno.test('canonicalGradeKey maps every known spelling', () => {
  for (const [input, expected] of CASES) assertEquals(canonicalGradeKey(input), expected, input)
})

Deno.test('canonicalGradeKey is idempotent', () => {
  for (const [input] of CASES) {
    const once = canonicalGradeKey(input)
    assertEquals(canonicalGradeKey(once), once, input)
  }
})

Deno.test('canonicalGradesPrices rewrites keys', () => {
  assertEquals(canonicalGradesPrices({ 'PSA 10': 500, Raw: 20, bgs_9_5: 300 }), {
    psa10: 500,
    ungraded: 20,
    bgs9_5: 300,
  })
})

Deno.test('gradePriceKey matches SQL grade_key', () => {
  assertEquals(gradePriceKey('PSA', 10), 'psa10')
  assertEquals(gradePriceKey('bgs', 9.5), 'bgs9_5')
  assertEquals(gradePriceKey(null, 10), 'ungraded')
  assertEquals(gradePriceKey('psa', null), 'ungraded')
})

Deno.test('splitGradeKey reads every known spelling', () => {
  assertEquals(splitGradeKey('psa10'), { company: 'PSA', grade: '10' })
  assertEquals(splitGradeKey('psa10.0'), { company: 'PSA', grade: '10' })
  assertEquals(splitGradeKey('bgs_9.5'), { company: 'BGS', grade: '9.5' })
  assertEquals(splitGradeKey('Raw'), 'raw')
  assertEquals(splitGradeKey('ungraded'), 'raw')
  assertEquals(splitGradeKey('weird key'), null)
  assertEquals(splitGradeKey(''), null)
})

Deno.test('splitGradeKey reads back what gradePriceKey builds', () => {
  for (const [slug, value] of [
    ['psa', 10],
    ['bgs', 9.5],
    ['cgc', 8],
  ] as const) {
    const parsed = splitGradeKey(gradePriceKey(slug, value))
    assertEquals(parsed, { company: slug.toUpperCase(), grade: String(value) })
  }
})
