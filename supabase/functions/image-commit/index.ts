// /functions/image_commit/index.ts
import { CardImageFields } from '@types'
import {
  commitCacheFromQueryHash,
  commitCacheFromUrl,
  commitCardImageFromCacheUpsert,
  createSupabaseServiceClient,
  ImageCacheRow,
} from '@utils'

const supabase = createSupabaseServiceClient()
const SAMPLE_SIZE = Deno.env.get('IMAGE_COMMIT_SAMPLE') ?? '3'

Deno.serve(async (req) => {
  // keep your auth check; allow service or signed-in user as you prefer
  const { url, query_hash, card_fields } = (await req.json()) as {
    url: string
    query_hash: string
    card_fields: Partial<CardImageFields> & { card_id: string; kind: string }
  }
  console.log('Image commit request', { url, query_hash, card_fields })
  if (!(url || query_hash)) {
    return new Response(JSON.stringify({ error: 'Missing url or card_fields' }), {
      status: 400,
    })
  }

  // Direct URL commit (stub card flow: source_url known, no query_hash)
  const isUrlCommit = Boolean(url && !query_hash)
  const cacheCommits = isUrlCommit
    ? await Promise.allSettled([commitCacheFromUrl(url, supabase)])
    : await commitCacheFromQueryHash(query_hash, Number(SAMPLE_SIZE))

  console.log('Committed images', cacheCommits)

  if (isUrlCommit && card_fields.card_id && card_fields.kind) {
    // Update the existing stub row in place — avoids duplicate card_images rows
    // (the stub has image_cache_id = null; a generic upsert would insert a second row)
    const successful = cacheCommits.find((c) => c.status === 'fulfilled') as PromiseFulfilledResult<
      ImageCacheRow | undefined
    >
    if (successful?.value) {
      const ic = successful.value
      const { error } = await supabase
        .from('card_images')
        .update({ image_cache_id: ic.id, storage_path: ic.storage_path, status: 'READY' })
        .eq('card_id', card_fields.card_id)
        .eq('kind', card_fields.kind)
        .is('image_cache_id', null)
      if (error) console.error('Error updating stub card_images row:', error)
    }
  } else if (card_fields.card_id && card_fields.kind) {
    console.log('Committing card image', card_fields)
    const cardImageResult = await commitCardImageFromCacheUpsert(
      card_fields,
      cacheCommits,
      supabase
    )
    if (!cardImageResult || cardImageResult.error) {
      console.error('Error committing images', cardImageResult?.error)
      return new Response(JSON.stringify({ error: cardImageResult?.error?.message }), {
        status: 500,
      })
    }
  }

  const commitResults = cacheCommits
    .filter((commit) => (commit as PromiseFulfilledResult<ImageCacheRow>).value)
    .map((commit) => (commit as PromiseFulfilledResult<ImageCacheRow>)?.value) as ImageCacheRow[]

  const commitErrors = cacheCommits.map((commit) => (commit as PromiseRejectedResult).reason)

  return new Response(
    JSON.stringify({
      commits: commitResults,
      errors: JSON.stringify(commitErrors),
      ok: true,
      mode: 'one',
    }),
    {
      status: 202,
      headers: { 'content-type': 'application/json' },
    }
  )
})
