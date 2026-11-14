import { callRpc } from './rpc'

type Params = {
  accessToken: string
  filter: Record<string, unknown>
  orderBy?: string
  pinned?: string[]
  excluded?: string[]
  limit?: number
}

export default async function (req: { params: Params }) {
  const { accessToken, filter, orderBy, pinned, excluded, limit } = req.params
  return callRpc('preview_promo_matches', accessToken, {
    p_filter: filter ?? {},
    p_order_by: orderBy ?? 'popularity',
    p_pinned: pinned ?? [],
    p_excluded: excluded ?? [],
    p_limit: limit ?? 12,
  })
}
