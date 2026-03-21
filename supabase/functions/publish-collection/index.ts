// publish/index.ts
import { createSupabaseClient, json, requireUser } from '@utils'

type PublishPayload = {
  collection_id: string
  slug: string
  title: string
  subset?: Array<{
    ref_id: string
    grade?: string
    condition?: string
    quantity?: number
  }>
}

Deno.serve(async (req) => {
  const userClient = createSupabaseClient(req)
  const user = await requireUser(userClient)

  if (req.method !== 'POST') return json({ error: 'method' }, { status: 405 })
  const body = (await req.json().catch(() => ({}))) as PublishPayload

  if (!body.collection_id || !body.slug || !body.title) {
    return json(
      { error: 'collection_id, slug, title required' },
      {
        status: 400,
      }
    )
  }

  const { data, error } = await userClient.rpc('publish_snapshot', {
    p_owner: user.id,
    p_collection_id: body.collection_id,
    p_slug: body.slug,
    p_title: body.title,
    p_subset: body.subset ?? null,
  })

  if (error) return json({ error: error.message }, { status: 400 })
  return json({ snapshot_id: data })
})
