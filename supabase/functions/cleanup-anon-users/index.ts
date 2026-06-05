import { createClient } from 'npm:@supabase/supabase-js'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const INACTIVE_DAYS = 30
const cutoffMs = INACTIVE_DAYS * 24 * 60 * 60 * 1000

Deno.serve(async (req) => {
  // Only accept internal calls from pg_cron via the edge token
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const cutoff = new Date(Date.now() - cutoffMs).toISOString()
  let deleted = 0
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) {
      console.error('listUsers error:', error.message)
      break
    }
    if (!data.users.length) break

    for (const user of data.users) {
      if (!user.is_anonymous) continue
      const lastActive = user.last_sign_in_at ?? user.created_at
      if (lastActive < cutoff) {
        const { error: delErr } = await supabase.auth.admin.deleteUser(user.id)
        if (delErr) console.error('deleteUser error:', user.id, delErr.message)
        else deleted++
      }
    }

    if (data.users.length < 1000) break
    page++
  }

  console.log(`cleanup-anon-users: deleted ${deleted} users inactive > ${INACTIVE_DAYS} days`)
  return new Response(JSON.stringify({ deleted }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
