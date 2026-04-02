import { CardHedgeCard } from '@types'

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
    body: JSON.stringify({ search: query, page_size: Math.min(limit, 100) }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`CardHedge API error ${resp.status}: ${body}`)
  }

  const data = (await resp.json()) as { cards?: CardHedgeCard[] }
  return data.cards ?? []
}
