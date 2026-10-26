// Resolves our cards row to a CardHedger card_id, cheapest and safest source first:
//   1. an existing external_refs row (provider 'cardhedge')
//   2. card-search, accepting only a result whose deterministic id matches —
//      cards first seen via CardHedger have cards.id = vendorUUID('cardhedge', card_id), so
//      this is an exact identity check with no AI involved
//   3. card-match (AI), accepted only above `matchThreshold` AND a name/set token score
//      (@enrichment-match scoreMatch) above `nameScoreThreshold`, since a wrong match is
//      persisted to external_refs and drives prices, savings and notifications.
// Dependencies are injected so the decision logic is unit-testable (cardhedge-resolve.test.ts).
import type { CardHedgeCard, CardMatchResponse } from './types.ts'
import { scoreMatch } from './enrichment-match.ts'

export type ResolveTarget = {
  id: string
  name: string | null
  set_name: string | null
  cardhedge_id?: string | null
}

export type ResolveDeps = {
  search: (query: string) => Promise<CardHedgeCard[]>
  match: (query: string) => Promise<CardMatchResponse>
  vendorUUID: (cardhedgeId: string) => string | Promise<string>
  matchThreshold: number
  nameScoreThreshold: number
  /** False once the run's card-match budget is spent — step 3 is then skipped. */
  allowMatch: boolean
}

export type ResolveResult =
  | { id: string; via: 'ref' | 'exact' | 'match'; confidence?: number; description?: string }
  | {
      miss: 'no_results' | 'low_confidence' | 'budget'
      confidence?: number
      description?: string
    }

export async function resolveCardHedgeId(
  card: ResolveTarget,
  deps: ResolveDeps
): Promise<ResolveResult> {
  if (card.cardhedge_id) return { id: card.cardhedge_id, via: 'ref' }

  const query = `${card.name ?? ''} ${card.set_name ?? ''}`.trim()
  if (!query) return { miss: 'no_results' }

  const results = await deps.search(query)
  for (const r of results) {
    if ((await deps.vendorUUID(r.card_id)) === card.id) {
      return { id: r.card_id, via: 'exact', description: r.description }
    }
  }

  if (!deps.allowMatch) return { miss: 'budget' }

  const { match } = await deps.match(query)
  if (!match) return { miss: results.length ? 'low_confidence' : 'no_results' }
  const nameScore = scoreMatch(
    { name: card.name ?? '', set_name: card.set_name ?? '' },
    { card: { name: match.description, set_name: match.set } }
  )
  if (match.confidence < deps.matchThreshold || nameScore < deps.nameScoreThreshold) {
    return { miss: 'low_confidence', confidence: match.confidence, description: match.description }
  }
  return {
    id: match.card_id,
    via: 'match',
    confidence: match.confidence,
    description: match.description,
  }
}
