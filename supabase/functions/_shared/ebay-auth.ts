import { EbayItemSummary } from '@types'

// Module-level token cache — survives warm instance restarts
let tokenCache: { token: string; expiresAt: number } | null = null

/**
 * Obtain an eBay OAuth 2.0 application token via client_credentials grant.
 * Token is cached in-memory and refreshed 60s before expiry.
 */
export async function getEbayToken(
  appId: string,
  certId: string,
  apiBase: string
): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token
  }

  const credentials = btoa(`${appId}:${certId}`)
  const resp = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`eBay token exchange failed ${resp.status}: ${body}`)
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number }
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return tokenCache.token
}

/**
 * Search eBay fixed-price listings via Browse API.
 * Filters to category 212 (Trading Card Singles) and FIXED_PRICE only.
 */
export async function searchEbayItems(
  query: string,
  token: string,
  apiBase: string,
  marketplaceId: string,
  limit: number
): Promise<EbayItemSummary[]> {
  const url = new URL(`${apiBase}/buy/browse/v1/item_summary/search`)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', String(Math.min(limit, 50)))
  url.searchParams.set('category_ids', '212') // Trading Card Singles
  url.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE}')

  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
      'Content-Type': 'application/json',
    },
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`eBay Browse API error ${resp.status}: ${body}`)
  }

  const data = (await resp.json()) as { itemSummaries?: EbayItemSummary[] }
  return data.itemSummaries ?? []
}
