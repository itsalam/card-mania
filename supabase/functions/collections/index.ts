// collections/index.ts
import { createSupabaseClient, json, requireUser } from '@utils'

Deno.serve(async (req) => {
  const userClient = createSupabaseClient(req)
  const user = await requireUser(userClient)

  const url = new URL(req.url)
  const method = req.method

  if (method === 'POST' && url.pathname.endsWith('/collections')) {
    // create
    const body = await req.json().catch(() => ({}))
    const name: string = body.name
    if (!name) return json({ error: 'name required' }, { status: 400 })

    const { data, error } = await userClient
      .from('collections')
      .insert({ name, user_id: user.id })
      .select()
      .single()

    if (error) return json({ error: error.message }, { status: 400 })
    return json(data)
  }

  if (method === 'PATCH' && url.pathname.endsWith('/collections')) {
    // rename or visibility change
    const body = await req.json().catch(() => ({}))
    const { id, name, visibility } = body
    if (!id) return json({ error: 'id required' }, { status: 400 })

    const { data, error } = await userClient
      .from('collections')
      .update({ ...(name && { name }), ...(visibility && { visibility }) })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return json({ error: error.message }, { status: 400 })
    return json(data)
  }

  if (method === 'DELETE' && url.pathname.endsWith('/collections')) {
    // archive (soft delete) or hard delete
    const body = await req.json().catch(() => ({}))
    const { id, hard } = body
    if (!id) return json({ error: 'id required' }, { status: 400 })

    if (hard) {
      const { error } = await userClient
        .from('collections')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) return json({ error: error.message }, { status: 400 })
      return json({ ok: true })
    } else {
      const { data, error } = await userClient
        .from('collections')
        .update({ visibility: 'archived' })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) return json({ error: error.message }, { status: 400 })
      return json(data)
    }
  }

  return json({ error: 'not found' }, { status: 404 })
})
