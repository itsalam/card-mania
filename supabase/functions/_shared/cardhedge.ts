import { CardHedgeCard, CardHedgePricePoint, CardMatchResponse } from '@types'

/**
 * Search CardHedge for card listings.
 * Uses POST /v1/cards/card-search with X-API-Key header.
 */
export async function fetchCardHedgeResults(
  query: string,
  apiKey: string,
  apiBase: string,
  limit: number
): Promise<CardHedgeCard[]> {
  const resp = await fetch(`${apiBase}/v1/cards/card-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ search: query, page_size: Math.min(limit, 100), raw_images_only: true }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`CardHedge API error ${resp.status}: ${body}`)
  }

  const data = (await resp.json()) as { cards?: CardHedgeCard[] }
  return data.cards ?? []
}

/**
 * AI-powered card matching via POST /v1/cards/card-match.
 * Returns the best match with a confidence score, or null if none meets the threshold.
 * The caller is responsible for applying the confidence threshold check.
 */
export async function fetchCardHedgeMatch(
  query: string,
  apiKey: string,
  apiBase: string,
  options?: { category?: string; maxCandidates?: number }
): Promise<CardMatchResponse> {
  const resp = await fetch(`${apiBase}/v1/cards/card-match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      query,
      category: options?.category,
      max_candidates: options?.maxCandidates ?? 10,
    }),
  })
  if (!resp.ok) {
    throw new Error(`CardHedge card-match error ${resp.status}: ${await resp.text()}`)
  }
  return (await resp.json()) as CardMatchResponse
}

/**
 * Fetch historical price points for a single card from CardHedge.
 * Used to backfill card_price_history when a user first views a card detail.
 *
 * NOTE: Verify the exact endpoint path + response shape against CardHedge API docs
 * before enabling this path — the assumed shape is { history: CardHedgePricePoint[] }.
 */
export async function fetchCardHedgeHistory(
  cardId: string,
  grade: string,
  apiKey: string,
  apiBase: string,
  days?: number
): Promise<CardHedgePricePoint[]> {
  const body: Record<string, unknown> = { card_id: cardId, grade }
  if (days) body.days = days
  const resp = await fetch(`${apiBase}/v1/cards/prices-by-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    throw new Error(`CardHedge history error ${resp.status}: ${await resp.text()}`)
  }
  const data = (await resp.json()) as { prices?: CardHedgePricePoint[] }
  return data.prices ?? []
}

/**
 * Fetch top-moving cards from CardHedge.
 * Uses GET /v1/cards/top-movers with X-API-Key header.
 */
export async function fetchCardHedgeTopMovers(
  apiKey: string,
  apiBase: string,
  count: number
): Promise<CardHedgeCard[]> {
  const url = new URL(`${apiBase}/v1/cards/top-movers`)
  url.searchParams.set('count', String(Math.min(count, 100)))
  const resp = await fetch(url.toString(), {
    headers: { 'X-API-Key': apiKey },
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`CardHedge top-movers error ${resp.status}: ${body}`)
  }
  const data = (await resp.json()) as { cards?: CardHedgeCard[] }
  return data.cards ?? []
}
