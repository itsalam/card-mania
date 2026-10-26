// Run: deno test supabase/functions/_shared/grade-key.test.ts
// Same case table as supabase/tests/grade_key_normalization.sql — keep the two in sync.
import { assertEquals } from 'jsr:@std/assert@1'
import { canonicalGradeKey, canonicalGradesPrices } from './grade-key.ts'

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
