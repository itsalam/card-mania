// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { Database, TablesInsert } from '@schema'
import { SupabaseClient } from '@supabase/supabase-js'
import { CardImageFields } from '@types'
import {
  buildSerpQuery,
  createSupabaseServiceClient,
  getImageCacheFromQueryHash,
  ImageCacheRow,
  normalize,
  sha256HexStr,
} from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

type Card = Database['public']['Tables']['cards']['Row']
type CardImageRow = Database['public']['Tables']['card_images']['Row']
type Image = {
  query_hash: string
  url: string | null
  kind: 'bound' | 'candidate'
  aspectRatio?: number | null
}

Deno.serve(async (req) => {
  // Step 1: Get the card ID from the request
  const { searchParams } = new URL(req.url)
  const populate = searchParams.get('populate') === 'true'
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
        commitCard(JSON.parse(card_hints ?? '{}') as Card & { image: Image }, supabase)
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
    grades_prices: cleanCardData.grades_prices || {},
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
