// Expo Push API helpers for push-dispatch: message building, chunking, and ticket/receipt
// interpretation. Dependency-free (fetch is injectable) so it's unit-testable.
//
// https://docs.expo.dev/push-notifications/sending-notifications/

export const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send'
export const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts'
/** Expo accepts at most 100 messages per send and 1000 ids per receipts request. */
export const SEND_CHUNK = 100
export const RECEIPT_CHUNK = 1000

export type OutboxRow = {
  outbox_id: number
  notification_id: string
  user_id: string
  title: string
  body: string
  category: string
  priority: string
  action_url: string | null
  tokens: string[]
  badge: number
}

export type ExpoMessage = {
  to: string
  title: string
  body: string
  sound: 'default'
  badge: number
  priority: 'default' | 'high'
  channelId: string
  data: { notification_id: string; action_url: string | null; category: string }
}

export type ExpoTicket =
  { status: 'ok'; id: string } | { status: 'error'; message?: string; details?: { error?: string } }

export type ExpoReceipt =
  { status: 'ok' } | { status: 'error'; message?: string; details?: { error?: string } }

/** Android channel ids — must match what the client creates (client/notifications/push.ts). */
export const channelFor = (category: string) =>
  category === 'offer' || category === 'transaction' ? 'offers' : 'default'

/** One message per (row, token); `outboxId` maps each message back to its row. */
export function buildMessages(rows: OutboxRow[]): { message: ExpoMessage; outboxId: number }[] {
  return rows.flatMap((row) =>
    row.tokens.map((token) => ({
      outboxId: row.outbox_id,
      message: {
        to: token,
        title: row.title,
        body: row.body,
        sound: 'default' as const,
        badge: row.badge,
        priority: row.priority === 'high' || row.priority === 'urgent' ? 'high' : 'default',
        channelId: channelFor(row.category),
        data: {
          notification_id: row.notification_id,
          action_url: row.action_url,
          category: row.category,
        },
      },
    }))
  )
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export type RowResult = {
  id: number
  status: 'sent' | 'failed' | 'pending'
  reason?: string
  tickets: { token: string; ticket_id: string }[]
}

/**
 * Folds per-message tickets into one result per outbox row. A row is 'sent' when at least one
 * device accepted it; 'failed' when every device was rejected. DeviceNotRegistered tokens are
 * returned as dead so the caller can prune them.
 */
export function interpretTickets(
  sent: { message: ExpoMessage; outboxId: number }[],
  tickets: ExpoTicket[]
): { results: RowResult[]; deadTokens: string[] } {
  const byRow = new Map<number, RowResult & { errors: string[] }>()
  const deadTokens: string[] = []

  sent.forEach(({ message, outboxId }, i) => {
    const row = byRow.get(outboxId) ?? { id: outboxId, status: 'failed', tickets: [], errors: [] }
    byRow.set(outboxId, row)
    const ticket = tickets[i]
    if (ticket?.status === 'ok') {
      row.status = 'sent'
      row.tickets.push({ token: message.to, ticket_id: ticket.id })
      return
    }
    const code = ticket?.details?.error ?? ticket?.message ?? 'missing_ticket'
    row.errors.push(code)
    if (code === 'DeviceNotRegistered') deadTokens.push(message.to)
  })

  const results = [...byRow.values()].map(({ errors, ...r }) =>
    r.status === 'failed' ? { ...r, reason: [...new Set(errors)].join(',') } : r
  )
  return { results, deadTokens }
}

/** Tokens whose receipts came back DeviceNotRegistered. */
export function deadTokensFromReceipts(
  tickets: { token: string; ticket_id: string }[],
  receipts: Record<string, ExpoReceipt>
): string[] {
  return tickets
    .filter(({ ticket_id }) => {
      const r = receipts[ticket_id]
      return r?.status === 'error' && r.details?.error === 'DeviceNotRegistered'
    })
    .map(({ token }) => token)
}

type Fetch = typeof fetch

function headers(accessToken?: string) {
  const h: Record<string, string> = {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate',
    'content-type': 'application/json',
  }
  if (accessToken) h.authorization = `Bearer ${accessToken}`
  return h
}

export class ExpoHttpError extends Error {
  constructor(
    public status: number,
    body: string
  ) {
    super(`Expo push HTTP ${status}: ${body.slice(0, 300)}`)
  }
}

export async function sendChunk(
  messages: ExpoMessage[],
  opts: { accessToken?: string; fetchFn?: Fetch } = {}
): Promise<ExpoTicket[]> {
  const res = await (opts.fetchFn ?? fetch)(EXPO_SEND_URL, {
    method: 'POST',
    headers: headers(opts.accessToken),
    body: JSON.stringify(messages),
  })
  const text = await res.text()
  if (!res.ok) throw new ExpoHttpError(res.status, text)
  return (JSON.parse(text).data ?? []) as ExpoTicket[]
}

export async function getReceipts(
  ids: string[],
  opts: { accessToken?: string; fetchFn?: Fetch } = {}
): Promise<Record<string, ExpoReceipt>> {
  const res = await (opts.fetchFn ?? fetch)(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: headers(opts.accessToken),
    body: JSON.stringify({ ids }),
  })
  const text = await res.text()
  if (!res.ok) throw new ExpoHttpError(res.status, text)
  return (JSON.parse(text).data ?? {}) as Record<string, ExpoReceipt>
}
