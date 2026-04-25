// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { fetchCardHedgeResults } from '@cardhedge'
import { CardImageFields } from '@types'
import {
  buildSerpQuery,
  createSupabaseServiceClient,
  fetchGlobalVars,
  getImageCacheFromQueryHash,
  ImageCacheRow,
  normalize,
  sha256HexStr,
} from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { SupabaseClient } from 'npm:@supabase/supabase-js'
import { Database, TablesInsert } from '../_shared/supabase.ts'

type Card = Database['public']['Tables']['cards']['Row']
type CardImageRow = Database['public']['Tables']['card_images']['Row']
type Image = {
  query_hash: string
  url: string | null
  kind: 'bound' | 'candidate'
  aspectRatio?: number | null
}

const PRICE_STALE_MS = Number(Deno.env.get('PRICE_STALE_HOURS') ?? '24') * 3_600_000

Deno.serve(async (req) => {
  // Step 1: Get the card ID from the request
  const { searchParams } = new URL(req.url)
  const populate = searchParams.get('populate') === 'true'
  const fresh = searchParams.get('fresh') === 'true'
  const card_id = searchParams.get('card_id')
  const card_hints = searchParams.get('card_hints')

  const supabase = createSupabaseServiceClient()

  // Step 2: Get the card data from the database

  let fetchedCard
  if (card_id) {
    const fetchCardReq = await supabase.from('cards').select('*').eq('id', card_id).single()
    fetchedCard = fetchCardReq.data
  }

  if (!fetchedCard) {
    if (populate) {
      console.debug('Populating card', { card_hints })

      EdgeRuntime.waitUntil(
        commitCard(JSON.parse(card_hints ?? '{}') as Card & { image: Image }, supabase).then(
          (result: Awaited<ReturnType<typeof commitCard>>) => {
            // Kick off a history backfill for the newly created card so the
            // detail view has rich historical data on first open.
            const newCardId = result?.data?.id
            if (newCardId) {
              const supaUrl = Deno.env.get('SUPABASE_URL')!
              const srole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
              return fetch(`${supaUrl}/functions/v1/fetch-card-history?card_id=${newCardId}`, {
                headers: { Authorization: `Bearer ${srole}` },
              }).catch((e) => console.error('[fetch-card] history backfill trigger failed:', e))
            }
          }
        )
      )
      return new Response(
        JSON.stringify({
          message: 'Card not found, populating for next fetch',
        }),
        { status: 206, headers: { 'Content-Type': 'application/json' } }
      )
    }
    return new Response(JSON.stringify({ error: 'Card not found' }), {
      status: 500,
    })
  }

  // Step 3: Refresh prices if stale or explicitly requested
  const lastUpdatedMs = fetchedCard.last_updated ? new Date(fetchedCard.last_updated).getTime() : 0
  const isStale = Date.now() - lastUpdatedMs > PRICE_STALE_MS
  if (fresh) {
    // Synchronous — block and serve fresh prices
    const refreshed = await refreshCardPrices(fetchedCard, supabase)
    if (refreshed) fetchedCard = { ...fetchedCard, ...refreshed }
  } else if (isStale) {
    // Fire-and-forget — serve DB prices now, freshen for next call
    EdgeRuntime.waitUntil(refreshCardPrices(fetchedCard, supabase))
  }

  let image: Image | undefined
  if (fetchedCard.front_image_id) {
    const { data: ci } = await supabase
      .from('card_images')
      .select('id, source_url, url_hash, image_cache(width, height)')
      .eq('id', fetchedCard.front_image_id)
      .maybeSingle()
    if (ci?.source_url) {
      const { width, height } =
        (ci.image_cache as { width: number | null; height: number | null } | null) ?? {}
      image = {
        kind: 'bound',
        url: ci.source_url,
        query_hash: ci.url_hash ?? '',
        aspectRatio: width && height ? width / height : null,
      }
    }
  } else {
    // front_image_id not yet set — check if image-proxy has already created a card_images row
    const { data: ci } = await supabase
      .from('card_images')
      .select('id, source_url, url_hash, image_cache(width, height)')
      .eq('card_id', fetchedCard.id)
      .eq('kind', 'front')
      .eq('status', 'READY')
      .maybeSingle()
    if (ci?.source_url) {
      const { width, height } =
        (ci.image_cache as { width: number | null; height: number | null } | null) ?? {}
      image = {
        kind: 'bound',
        url: ci.source_url,
        query_hash: ci.url_hash ?? '',
        aspectRatio: width && height ? width / height : null,
      }
      // Lazily backfill front_image_id so future fetches skip this lookup
      supabase.from('cards').update({ front_image_id: ci.id }).eq('id', fetchedCard.id)
    }
  }

  // Fallback: image job still running — use query_hash from card_hints so
  // the client can serve the image immediately via image-proxy
  if (!image && card_hints) {
    try {
      const hints = JSON.parse(card_hints) as { image?: Image }
      if (hints.image?.query_hash) {
        image = {
          kind: 'candidate',
          url: hints.image.url ?? null,
          query_hash: hints.image.query_hash,
        }
      }
    } catch {
      // ignore malformed card_hints
    }
  }

  return new Response(JSON.stringify({ data: { ...fetchedCard, image } }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

/**
 * Fetch fresh prices for a card from every vendor it has an external_ref for.
 * Merges results and writes them back to the cards table.
 * Returns the updated fields, or null if no vendor had data.
 */
async function refreshCardPrices(
  card: Card,
  supabase: SupabaseClient<Database>
): Promise<Pick<Card, 'grades_prices' | 'latest_price' | 'last_updated'> | null> {
  const { data: refs } = await supabase
    .from('external_refs')
    .select('provider, external_id')
    .eq('card_id', card.id)

  if (!refs?.length) return null

  const { supa: _supa, srole: _srole } = fetchGlobalVars()
  const pcBase = Deno.env.get('PRICECHARTING_API_BASE')
  const pcKey = Deno.env.get('PRICECHARTING_API_KEY')
  const chBase = Deno.env.get('CARDHEDGE_API_BASE')
  const chKey = Deno.env.get('CARDHEDGE_API_KEY')

  // Lower vendor number = higher priority; we record which vendor contributed each grade
  // so higher-priority data overwrites lower-priority data for the same key.
  const pricesByVendor: Array<{
    priority: number
    prices: Record<string, number>
    latestPrice: number | null
  }> = []

  await Promise.allSettled(
    refs.map(async ({ provider, external_id }) => {
      if (provider === 'pricecharting' && pcBase && pcKey) {
        const url = new URL(`${pcBase}/api/product`)
        url.searchParams.set('t', pcKey)
        url.searchParams.set('id', external_id)
        const res = await fetch(url.toString(), { headers: { accept: 'application/json' } })
        if (!res.ok) {
          console.error('[fetch-card] PriceCharting fetch failed', res.status)
          return
        }
        const raw = await res.json()
        const prices: Record<string, number> = {}
        const fieldMap: Record<string, string> = {
          ungraded: 'loose-price',
          psa10: 'manual-only-price',
          psa9_5: 'box-only-price',
          psa9: 'graded-price',
          psa8: 'new-price',
          psa7: 'cib-price',
          cgc10: 'condition-17-price',
          sgc10: 'condition-18-price',
        }
        for (const [grade, field] of Object.entries(fieldMap)) {
          const val = raw[field]
          if (val != null && val > 0) prices[grade] = val
        }
        pricesByVendor.push({ priority: 2, prices, latestPrice: raw['loose-price'] ?? null })
      } else if (provider === 'cardhedge' && chBase && chKey) {
        const results = await fetchCardHedgeResults(
          `${card.name} ${card.set_name ?? ''}`.trim(),
          chKey,
          chBase,
          20
        )
        const match = results.find((r) => r.card_id === external_id)
        if (!match?.prices) return
        const prices: Record<string, number> = {}
        let latestPrice: number | null = null
        for (const { grade, price } of match.prices) {
          const raw_key = grade.toLowerCase().replace(/\s+/g, '_')
          const key = raw_key === 'raw' ? 'ungraded' : raw_key
          const val = Math.round(parseFloat(price) * 100)
          if (!isNaN(val) && val > 0) prices[key] = val
        }
        const rawEntry = match.prices.find((p) => p.grade.toLowerCase() === 'raw')
        if (rawEntry) latestPrice = Math.round(parseFloat(rawEntry.price) * 100) || null
        pricesByVendor.push({ priority: 1, prices, latestPrice })
      }
    })
  )

  if (!pricesByVendor.length) return null

  // Merge: lower priority number wins when both vendors have the same grade key
  const sorted = pricesByVendor.sort((a, b) => a.priority - b.priority)
  const mergedPrices: Record<string, number> = {}
  let mergedLatestPrice: number | null = null
  for (const { prices, latestPrice } of sorted) {
    Object.assign(mergedPrices, prices)
    mergedLatestPrice ??= latestPrice
  }

  if (!Object.keys(mergedPrices).length) return null

  const last_updated = new Date().toISOString()
  const { error } = await supabase
    .from('cards')
    .update({ grades_prices: mergedPrices, latest_price: mergedLatestPrice, last_updated })
    .eq('id', card.id)

  if (error) {
    console.error('[fetch-card] price refresh update failed:', error)
    return null
  }

  // Snapshot each grade price into history — one row per grade per refresh.
  // Granularity matches the fetch cadence (default: once per 24 h per card).
  const historyRows = Object.entries(mergedPrices).map(([grade, price_cents]) => ({
    card_id: card.id,
    grade,
    price_cents,
  }))
  const { error: histErr } = await supabase
    .from('card_price_history')
    .upsert(historyRows, { ignoreDuplicates: true })
  if (histErr) console.error('[fetch-card] price history insert failed:', histErr)

  console.debug('[fetch-card] price refreshed', { id: card.id, vendors: pricesByVendor.length })
  return { grades_prices: mergedPrices, latest_price: mergedLatestPrice, last_updated }
}

function normalizeGradesPrices(gp: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [key, val] of Object.entries(gp)) {
    const normKey = key.toLowerCase().replace(/\s+/g, '_')
    result[normKey === 'raw' ? 'ungraded' : normKey] = val
  }
  return result
}

async function commitCard(
  cardLike: Partial<Card> & { image: Image },
  supabase: SupabaseClient<Database>
) {
  const { image, ...cardData } = cardLike

  const cleanCardData = Object.fromEntries(
    Object.entries(cardData).filter(([_, value]) => value != null)
  ) as Partial<Card>

  const cardInsertRecord = {
    id: cardLike.id,
    name: cleanCardData.name || '',
    genre: cleanCardData.genre || '',
    set_name: cleanCardData.set_name || '',
    latest_price: cleanCardData.latest_price || null,
    grades_prices: normalizeGradesPrices(
      (cleanCardData.grades_prices as Record<string, number>) || {}
    ),
    last_updated: new Date().toISOString(),
    // do not set images here; handled below
  } satisfies TablesInsert<'cards'>

  const cardInsert = await supabase.from('cards').insert(cardInsertRecord).select('*').single()
  if (cardInsert.error) {
    console.error('Error inserting card', cardInsert.error)
    return null
  }

  const promises: Promise<unknown>[] = []
  const cardRecord = cardInsert.data
  const cardId = cardLike.id || cardRecord?.id

  // Strategy 1: snapshot today's prices immediately so the first price-fetch
  // call for this card returns real data rather than triggering a pending backfill.
  if (cardId) {
    const gradesPrices = cardInsertRecord.grades_prices as Record<string, number>
    const stubRows = Object.entries(gradesPrices).map(([grade, price]) => ({
      card_id: cardId,
      grade,
      price_cents: Math.round(price * 100),
    }))
    if (stubRows.length) {
      supabase
        .from('card_price_history')
        .upsert(stubRows, { ignoreDuplicates: true })
        .then(({ error }) => {
          if (error) console.error('[commitCard] initial price stub failed:', error)
        })
    }
  }
  if (image && image.query_hash && cardId) {
    const frontCardImageWiring = getImageCacheFromQueryHash(image.query_hash, supabase)
      .then(async ({ ic }) => {
        if (ic) {
          return insertCardImageFromCache(cardId, ic, { kind: 'front' }, supabase)
            .select()
            .maybeSingle()
            .then((result: { data: CardImageRow | null; error: unknown }) => {
              if (result.error) {
                console.error('Error inserting card image', result.error)
              }
              return result.data
            })
        }
        // No image_cache row yet — if we have a direct vendor URL, seed it now
        if (image.url) {
          const urlHash = await sha256HexStr(image.url)
          const { data: seeded, error: seedErr } = await supabase
            .from('image_cache')
            .upsert(
              {
                source_url: image.url,
                url_hash: urlHash,
                query_hash: image.query_hash,
                status: 'external',
                is_top_for_query: true,
                expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
              },
              { onConflict: 'url_hash' }
            )
            .select('*')
            .maybeSingle()
          if (seedErr) console.error('Error seeding image_cache from direct URL', seedErr)
          if (seeded) {
            return insertCardImageFromCache(cardId, seeded, { kind: 'front' }, supabase)
              .select()
              .maybeSingle()
              .then((result) => {
                if (result.error)
                  console.error('Error inserting card image from seeded cache', result.error)
                return result.data
              })
          }
        }
        console.error('No image cache found for query hash', image.query_hash)
      })
      .then((value) => {
        if (value) {
          supabase
            .from('cards')
            .update({
              front_image_id: value.id,
            })
            .eq('id', cardId)
        }
      })
    promises.push(frontCardImageWiring)
  } else {
    console.log('No image query hash found, populating front image, for next fetch')
    const populateFront = populateCardImages(cardRecord, supabase, ['front'])
    promises.push(populateFront)
  }

  promises.push(populateCardImages(cardRecord, supabase, ['back']))

  await Promise.all(promises)

  return cardInsert
}

const insertCardImageFromCache = (
  cardId: string,
  ic: ImageCacheRow,
  ci: Partial<CardImageFields>,
  supabase: SupabaseClient<Database>
) => {
  return supabase.from('card_images').insert({
    card_id: cardId,
    image_cache_id: ic.id,
    status: 'READY',
    width: ic.width,
    height: ic.height,
    source_url: ic.source_url,
    url_hash: ic.url_hash,
    content_type: ic.content_type || ic.mime,
    storage_path: ic.storage_path,
    is_primary: true,
    ...ci,
  })
}

const populateCardImages = async (
  card: Card,
  supabase: SupabaseClient<Database>,
  context: string[]
) => {
  const backImage = buildSerpQuery(
    {
      name: card.name,
      set: card.set_name,
      year: card.release_date ? parseInt(card.release_date) : undefined,
    },
    { includeNegatives: true, extraContext: context }
  )

  const qNorm = normalize(backImage)
  const qHash = await sha256HexStr(qNorm)

  const backImageCommit = (await supabase.functions
    .invoke('image-commit', {
      method: 'POST',
      body: { query_hash: qHash, card_fields: card },
    })
    .catch((e: unknown) => {
      console.error('Image commit failed:', e)
    })) as { data: { commits: ImageCacheRow[] } }
  console.debug('Back image commit', backImageCommit)
  const imageCommitUpdateResults = backImageCommit?.data?.commits?.map((commit) => {
    try {
      if (commit.id) {
        insertCardImageFromCache(card.id, commit, { kind: 'back' }, supabase)
        supabase
          .from('cards')
          .update({
            back_image_id: commit.id,
          })
          .eq('id', card.id)
      }
    } catch (e) {
      console.error('Error inserting card image', e)
    }
  })
  await Promise.all(imageCommitUpdateResults)
  return backImageCommit
}
