import { assertEquals } from 'jsr:@std/assert@1'
import {
  buildMessages,
  chunk,
  deadTokensFromReceipts,
  interpretTickets,
  OutboxRow,
  sendChunk,
} from './expo-push.ts'

const row = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  outbox_id: 1,
  notification_id: 'n1',
  user_id: 'u1',
  title: 'New Offer Received',
  body: 'You received a new offer for $10',
  category: 'offer',
  priority: 'high',
  action_url: '/offers?view=inbox',
  tokens: ['ExponentPushToken[a]'],
  badge: 2,
  ...over,
})

Deno.test('buildMessages fans out one message per token with routing data', () => {
  const msgs = buildMessages([
    row({ tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'] }),
    row({ outbox_id: 2, category: 'price', priority: 'normal', action_url: null }),
  ])
  assertEquals(msgs.length, 3)
  assertEquals(
    msgs.map((m) => m.outboxId),
    [1, 1, 2]
  )
  assertEquals(msgs[0].message.priority, 'high')
  assertEquals(msgs[0].message.channelId, 'offers')
  assertEquals(msgs[0].message.data, {
    notification_id: 'n1',
    action_url: '/offers?view=inbox',
    category: 'offer',
  })
  assertEquals(msgs[2].message.priority, 'default')
  assertEquals(msgs[2].message.channelId, 'default')
})

Deno.test('chunk splits at the size boundary', () => {
  assertEquals(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assertEquals(chunk([], 100), [])
})

Deno.test('interpretTickets: sent if any device accepted, dead tokens collected', () => {
  const sent = buildMessages([
    row({ tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'] }),
    row({ outbox_id: 2, tokens: ['ExponentPushToken[c]'] }),
  ])
  const { results, deadTokens } = interpretTickets(sent, [
    { status: 'ok', id: 't-a' },
    { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
    { status: 'error', message: 'bad', details: { error: 'MessageTooBig' } },
  ])
  assertEquals(results, [
    { id: 1, status: 'sent', tickets: [{ token: 'ExponentPushToken[a]', ticket_id: 't-a' }] },
    { id: 2, status: 'failed', tickets: [], reason: 'MessageTooBig' },
  ])
  assertEquals(deadTokens, ['ExponentPushToken[b]'])
})

Deno.test('interpretTickets treats a missing ticket as a failure', () => {
  const sent = buildMessages([row()])
  const { results } = interpretTickets(sent, [])
  assertEquals(results[0].status, 'failed')
  assertEquals(results[0].reason, 'missing_ticket')
})

Deno.test('deadTokensFromReceipts picks only DeviceNotRegistered', () => {
  const dead = deadTokensFromReceipts(
    [
      { token: 'A', ticket_id: '1' },
      { token: 'B', ticket_id: '2' },
      { token: 'C', ticket_id: '3' },
    ],
    {
      '1': { status: 'ok' },
      '2': { status: 'error', details: { error: 'DeviceNotRegistered' } },
      '3': { status: 'error', details: { error: 'MessageRateExceeded' } },
    }
  )
  assertEquals(dead, ['B'])
})

Deno.test('sendChunk posts JSON and returns tickets; sends access token when given', async () => {
  let seen: { url: string; init: RequestInit } | null = null
  const fetchFn = ((url: string, init: RequestInit) => {
    seen = { url, init }
    return Promise.resolve(
      new Response(JSON.stringify({ data: [{ status: 'ok', id: 'x' }] }), { status: 200 })
    )
  }) as unknown as typeof fetch
  const tickets = await sendChunk([buildMessages([row()])[0].message], {
    accessToken: 'tok',
    fetchFn,
  })
  assertEquals(tickets, [{ status: 'ok', id: 'x' }])
  assertEquals((seen!.init.headers as Record<string, string>).authorization, 'Bearer tok')
  assertEquals(JSON.parse(seen!.init.body as string).length, 1)
})
