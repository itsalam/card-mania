import { callRpc } from './rpc'

type Params = { accessToken: string; query: string }

export default async function (req: { params: Params }) {
  const { accessToken, query } = req.params
  return callRpc('search_card_sets', accessToken, { p_query: query ?? '', p_limit: 20 })
}
