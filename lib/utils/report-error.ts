import { imperativeDevToast } from '@/components/Toast'
import { getSupabase } from '@/lib/store/client'

type ReportErrorOpts = {
  context: string
  error: unknown
  metadata?: Record<string, unknown>
}

export async function reportError({ context, error, metadata }: ReportErrorOpts): Promise<void> {
  const message = JSON.stringify(error instanceof Error ? error.message : String(error), null, 2)
  console.log({ message })

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${context}]`, message, metadata ?? '')
    imperativeDevToast({ title: `[${context}]`, message, preset: 'failure', autoDismiss: 6000 })
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
