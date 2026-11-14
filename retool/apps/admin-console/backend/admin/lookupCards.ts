import { callRpc } from './rpc'

type Params = { accessToken: string; refIds: string[] }

export default async function (req: { params: Params }) {
  const { accessToken, refIds } = req.params
  if (!refIds || refIds.length === 0) return { ok: true as const, data: [] }
  return callRpc('lookup_cards', accessToken, { p_ref_ids: refIds })
}
