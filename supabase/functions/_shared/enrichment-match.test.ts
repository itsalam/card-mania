// Run: deno test supabase/functions/_shared/enrichment-match.test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { matchTokens, pickBestMatch, scoreMatch } from './enrichment-match.ts'

const THRESHOLD = 0.7
const r = (name: string, set_name = '', img = true) => ({
  card: { name, set_name, image: img ? { query_hash: name } : undefined },
})
const hasImage = (c: ReturnType<typeof r>) => Boolean(c.card.image)

Deno.test('matchTokens lowercases, strips accents and punctuation', () => {
  assertEquals(matchTokens('Pokémon: Charizard-EX #4/102'), [
    'pokemon',
    'charizard',
    'ex',
    '4',
    '102',
  ])
})

Deno.test('exact name + set scores 1', () => {
  assertEquals(
    scoreMatch({ name: 'Charizard', set_name: 'Base Set' }, r('Charizard', 'Base Set')),
    1
  )
})

Deno.test('name and set folded into an eBay-style title still match', () => {
  const s = scoreMatch(
    { name: 'Charizard', set_name: 'Base Set' },
    r('PSA 9 Charizard Holo 4/102 Pokemon Base Set 1999', 'Trading Card Singles')
  )
  assertEquals(s, 1)
})

Deno.test('a different card in the same set is rejected', () => {
  const s = scoreMatch({ name: 'Charizard', set_name: 'Base Set' }, r('Blastoise', 'Base Set'))
  assert(s < THRESHOLD, `score ${s}`)
})

Deno.test('a variant missing the distinguishing token is rejected', () => {
  // "Pikachu V" vs plain "Pikachu" without set evidence
  const s = scoreMatch(
    { name: 'Pikachu V', set_name: 'Vivid Voltage' },
    r('Pikachu', 'Shining Fates')
  )
  assert(s < THRESHOLD, `score ${s}`)
})

Deno.test('right name in the wrong set still passes but ranks below the right set', () => {
  const target = { name: 'Charizard', set_name: 'Base Set' }
  const res = pickBestMatch(
    target,
    [r('Charizard', 'Evolutions'), r('Charizard', 'Base Set')],
    THRESHOLD
  )
  assertEquals(res?.best.card.set_name, 'Base Set')
})

Deno.test('pickBestMatch skips ineligible (imageless) candidates', () => {
  const target = { name: 'Charizard', set_name: 'Base Set' }
  const res = pickBestMatch(
    target,
    [r('Charizard', 'Base Set', false), r('Charizard', 'Base Set 2')],
    THRESHOLD,
    hasImage
  )
  assertEquals(res?.best.card.set_name, 'Base Set 2')
})

Deno.test('pickBestMatch returns null when nothing clears the threshold', () => {
  const res = pickBestMatch(
    { name: 'Charizard', set_name: 'Base Set' },
    [r('Venusaur', 'Jungle')],
    THRESHOLD
  )
  assertEquals(res, null)
})

Deno.test('catalog genre prefix in set_name does not dilute an eBay title match', () => {
  const s = scoreMatch(
    { name: 'Paul Skenes #98', set_name: 'Baseball Cards 2025 Topps' },
    r('2025 Topps Baseball #98 Paul Skenes Pirates', 'Sports Trading Card Singles')
  )
  assertEquals(s, 1)
})

Deno.test('a base card prefers the base result over a parallel that also covers it', () => {
  const target = { name: 'Shohei Ohtani #1', set_name: 'Baseball Cards 2025 Topps' }
  const res = pickBestMatch(
    target,
    [r('Shohei Ohtani [Foilfractor] #1', '2025 Topps'), r('Shohei Ohtani #1', '2025 Topps')],
    THRESHOLD
  )
  assertEquals(res?.best.card.name, 'Shohei Ohtani #1')
})

Deno.test('a parallel is not matched by the base result', () => {
  const s = scoreMatch(
    { name: 'Shohei Ohtani [Foilfractor] #1', set_name: 'Baseball Cards 2025 Topps' },
    r('Shohei Ohtani #400', '2025 Topps Series 2')
  )
  assert(s < THRESHOLD, `score ${s}`)
})

Deno.test('empty target name never matches', () => {
  assertEquals(scoreMatch({ name: '', set_name: 'Base Set' }, r('Base Set')), 0)
})
