import { callRpc } from './rpc'

/** from/to are UTC dates (YYYY-MM-DD); either may be omitted (default: the last 30 days). */
type Params = { accessToken: string; from?: string; to?: string }

export default async function (req: { params: Params }) {
  const { accessToken, from, to } = req.params
  return callRpc('promo_results', accessToken, { p_from: from ?? null, p_to: to ?? null })
}
