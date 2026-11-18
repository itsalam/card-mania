import { callRpc } from './rpc'

type Params = { accessToken: string; promoId: string; from?: string; to?: string }

export default async function (req: { params: Params }) {
  const { accessToken, promoId, from, to } = req.params
  return callRpc('promo_results_daily', accessToken, {
    p_promo_id: promoId,
    p_from: from ?? null,
    p_to: to ?? null,
  })
}
