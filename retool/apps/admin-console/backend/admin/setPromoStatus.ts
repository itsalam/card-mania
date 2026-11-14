import { callRpc } from './rpc'

const STATUSES = ['draft', 'published', 'archived'] as const

type Params = { accessToken: string; id: string; status: string }

export default async function (req: { params: Params }) {
  const { accessToken, id, status } = req.params
  if (!id) return { ok: false as const, message: 'Promo ID is required.' }
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return { ok: false as const, message: 'Status must be draft, published or archived.' }
  }
  return callRpc('set_promo_status', accessToken, { p_id: id, p_status: status })
}
