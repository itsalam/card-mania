import { getSupabase } from '@/lib/store/client'

type ReportErrorOpts = {
  context: string
  error: unknown
  metadata?: Record<string, unknown>
}

export async function reportError({ context, error, metadata }: ReportErrorOpts): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${context}]`, message, metadata ?? '')
    return
  }

  try {
    const sb = getSupabase()
    const {
      data: { user },
    } = await sb.auth.getUser()
    await sb.from('client_errors').insert({
      user_id: user?.id ?? null,
      context,
      message,
      metadata: metadata ?? null,
    })
  } catch {
    // never let the reporter throw
  }
}
