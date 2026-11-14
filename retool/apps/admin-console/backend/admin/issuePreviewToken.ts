import { callRpc } from './rpc'

type Params = { accessToken: string; promoId: string }

export default async function (req: { params: Params }) {
  const { accessToken, promoId } = req.params
  if (!promoId) return { ok: false as const, message: 'Save the promo first.' }
  return callRpc('issue_preview_token', accessToken, { p_promo_id: promoId })
}
