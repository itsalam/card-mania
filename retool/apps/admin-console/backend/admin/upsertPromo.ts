import { callRpc } from './rpc'

type Params = { accessToken: string; payload: Record<string, unknown> }

/** Create (no payload.id) or update a promo. Send payload.revision to catch conflicting saves. */
export default async function (req: { params: Params }) {
  const { accessToken, payload } = req.params
  if (!payload || typeof payload !== 'object') return { ok: false as const, message: 'Nothing to save.' }
  return callRpc('upsert_promo', accessToken, { p_payload: payload })
}
