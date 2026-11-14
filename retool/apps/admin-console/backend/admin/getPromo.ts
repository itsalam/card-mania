import { callRpc } from './rpc'

type Params = { accessToken: string; id: string }

export default async function (req: { params: Params }) {
  const { accessToken, id } = req.params
  if (!id) return { ok: false as const, message: 'Promo ID is required.' }
  return callRpc('get_promo', accessToken, { p_id: id })
}
