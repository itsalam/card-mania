// Run: deno test supabase/functions/_shared/cardhedge-resolve.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import type { CardHedgeCard, CardMatchResponse } from './types.ts'
import { resolveCardHedgeId, type ResolveDeps } from './cardhedge-resolve.ts'

const card = { id: 'uuid-of-ch-42', name: 'Charizard', set_name: 'Base Set' }
const result = (card_id: string, description = 'Charizard'): CardHedgeCard => ({
  card_id,
  description,
  set: 'Base Set',
})
const matchResp = (confidence: number, description = 'Charizard'): CardMatchResponse => ({
  match: {
    confidence,
    reasoning: '',
    description,
    player: '',
    set: 'Base Set',
    number: '4',
    card_id: 'ch-match',
  },
  candidates_evaluated: 5,
  search_query_used: 'Charizard Base Set',
})

const deps = (over: Partial<ResolveDeps> = {}): ResolveDeps & { calls: string[] } => {
  const calls: string[] = []
  return {
    calls,
    search: (q) => (calls.push(`search:${q}`), Promise.resolve([result('ch-7'), result('ch-42')])),
    match: () => (calls.push('match'), Promise.resolve(matchResp(0.95))),
    vendorUUID: (id) => `uuid-of-${id}`,
    matchThreshold: 0.8,
    nameScoreThreshold: 0.7,
    allowMatch: true,
    ...over,
  }
}

Deno.test('an existing external_refs id is used without any API call', async () => {
  const d = deps()
  assertEquals(await resolveCardHedgeId({ ...card, cardhedge_id: 'ch-ref' }, d), {
    id: 'ch-ref',
    via: 'ref',
  })
  assertEquals(d.calls, [])
})

Deno.test('an exact vendorUUID match in search results beats card-match', async () => {
  const d = deps()
  const r = await resolveCardHedgeId(card, d)
  assertEquals(r, { id: 'ch-42', via: 'exact', description: 'Charizard' })
  assertEquals(d.calls, ['search:Charizard Base Set'])
})

Deno.test('falls back to card-match above both thresholds', async () => {
  const d = deps({ search: () => Promise.resolve([result('ch-7')]) })
  const r = await resolveCardHedgeId(card, d)
  assertEquals(r, { id: 'ch-match', via: 'match', confidence: 0.95, description: 'Charizard' })
})

Deno.test('rejects a low-confidence card-match', async () => {
  const d = deps({
    search: () => Promise.resolve([]),
    match: () => Promise.resolve(matchResp(0.6)),
  })
  assertEquals(await resolveCardHedgeId(card, d), {
    miss: 'low_confidence',
    confidence: 0.6,
    description: 'Charizard',
  })
})

Deno.test('rejects a confident card-match whose name does not fit', async () => {
  const d = deps({
    search: () => Promise.resolve([]),
    match: () => Promise.resolve(matchResp(0.97, 'Blastoise')),
  })
  const r = await resolveCardHedgeId(card, d)
  assertEquals('miss' in r && r.miss, 'low_confidence')
})

Deno.test('skips card-match once the run budget is spent', async () => {
  const d = deps({ search: () => Promise.resolve([]), allowMatch: false })
  assertEquals(await resolveCardHedgeId(card, d), { miss: 'budget' })
  assertEquals(d.calls.includes('match'), false)
})
