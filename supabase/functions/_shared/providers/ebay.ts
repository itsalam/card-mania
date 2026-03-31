import { SearchResultItem } from '@types'
import { vendorUUID } from '@utils'

const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token'
const EBAY_BROWSE_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search'

// eBay category IDs for trading cards
const SPORTS_CARDS_CATEGORY_ID = '183454'
const NON_SPORT_CARDS_CATEGORY_ID = '2536' // Pokémon, MTG, Yu-Gi-Oh, etc.

// Module-level app token cache: lives for the function instance lifetime
let _appToken: { value: string; expiresAt: number } | null = null

/**
 * Fetch an eBay application-level OAuth2 token (client credentials grant).
 * Valid ~2h; cached in module memory so subsequent calls within the same
 * function instance skip the network round-trip.
 */
export async function getEbayAppToken(appId: string, certId: string): Promise<string> {
  const now = Date.now()
  if (_appToken && _appToken.expiresAt > now + 60_000) return _appToken.value

  const credentials = btoa(`${appId}:${certId}`)
  const res = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }).toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`eBay OAuth failed ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  _appToken = { value: data.access_token, expiresAt: now + data.expires_in * 1000 }
  return _appToken.value
}

export type EbaySearchFilters = {
  minPrice?: number
  maxPrice?: number
  /**
   * When set, scopes the Browse API query to a specific eBay seller username.
   * Used to surface a user's own active listings in search results.
   */
  sellerUsername?: string
  offset?: number
  limit?: number
}

/**
 * Search eBay's Browse API for trading card listings using app-level OAuth.
 * No user authentication required — results are public marketplace listings.
 */
export async function searchEbayListings(
  q: string,
  filters: EbaySearchFilters,
  appToken: string,
  marketplace = 'EBAY_US'
): Promise<SearchResultItem[]> {
  const url = new URL(EBAY_BROWSE_URL)
  url.searchParams.set('q', q)
  // Include both sports and non-sport TCG categories
  url.searchParams.set('category_ids', `${SPORTS_CARDS_CATEGORY_ID},${NON_SPORT_CARDS_CATEGORY_ID}`)
  url.searchParams.set('sort', 'BEST_MATCH')
  url.searchParams.set('limit', String(filters.limit ?? 20))
  if (filters.offset) url.searchParams.set('offset', String(filters.offset))

  const ebayFilters: string[] = []
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const min = filters.minPrice ?? 0
    const max = filters.maxPrice
    ebayFilters.push(max !== undefined ? `price:[${min}..${max}]` : `price:[${min}..]`)
  }
  if (filters.sellerUsername) {
    ebayFilters.push(`sellers:{${filters.sellerUsername}}`)
  }
  if (ebayFilters.length) url.searchParams.set('filter', ebayFilters.join(','))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${appToken}`,
      'X-EBAY-C-MARKETPLACE-ID': marketplace,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`eBay Browse API ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const items: any[] = data.itemSummaries ?? []

  return Promise.all(items.map((item) => mapEbayItemToResult(item)))
}

/**
 * Look up the eBay seller username linked to a Supabase user.
 * Requires service role access. Returns null if no account is linked.
 *
 * Depends on the `user_ebay_accounts` table (see migration
 * 20260329000000_user_ebay_accounts.sql).
 */
export async function getUserEbaySellerUsername(
  userId: string,
  supa: string,
  srole: string
): Promise<string | null> {
  const res = await fetch(
    `${supa}/rest/v1/user_ebay_accounts?user_id=eq.${encodeURIComponent(userId)}&select=ebay_username&limit=1`,
    { headers: { apikey: srole, authorization: `Bearer ${srole}` } }
  )
  if (!res.ok) return null
  const rows = (await res.json()) as Array<{ ebay_username: string }>
  return rows[0]?.ebay_username ?? null
}

async function mapEbayItemToResult(item: any): Promise<SearchResultItem> {
  const isAuction = (item.buyingOptions as string[] | undefined)?.includes('AUCTION') ?? false
  const listPrice = parseFloat(item.price?.value ?? '0')
  const currentBid = item.currentBidPrice ? parseFloat(item.currentBidPrice.value) : undefined
  const displayPrice = isAuction && currentBid !== undefined ? currentBid : listPrice

  const snippetParts: string[] = []
  if (item.condition?.conditionDisplayName) snippetParts.push(item.condition.conditionDisplayName)
  snippetParts.push(isAuction ? `$${displayPrice.toFixed(2)} bid` : `$${displayPrice.toFixed(2)}`)
  if (item.seller?.username) snippetParts.push(`by ${item.seller.username}`)
  snippetParts.push('eBay')

  return {
    id: item.itemId,
    card: {
      id: await vendorUUID('ebay', item.itemId),
      name: item.title,
      set_name: item.subtitle ?? extractSetFromTitle(item.title),
      latest_price: displayPrice,
      grades_prices: {},
      genre: 'trading-cards',
    },
    score: 0,
    snippet: snippetParts.join(' • '),
    source: 'vendor',
    reason: {
      provider: 'ebay',
      buying_option: item.buyingOptions?.[0] ?? 'FIXED_PRICE',
      is_auction: isAuction,
      seller_username: item.seller?.username,
      ebay_item_id: item.itemId,
      listing_url: item.itemWebUrl,
      image_url: item.image?.imageUrl,
      condition: item.condition?.conditionDisplayName,
    },
  }
}

/** Derive a rough set/brand string from an eBay listing title. */
function extractSetFromTitle(title: string): string {
  const yearMatch = title.match(/\b(19|20)\d{2}\b/)
  const brandMatch = title.match(
    /\b(Topps|Panini|Donruss|Fleer|Upper Deck|Bowman|Score|Leaf|Prizm|Select|Mosaic|Optic|Chrome)\b/i
  )
  if (yearMatch && brandMatch) return `${yearMatch[0]} ${brandMatch[0]}`
  return brandMatch?.[0] ?? yearMatch?.[0] ?? ''
}
