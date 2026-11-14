import { callRpc } from './rpc'

type Params = { accessToken: string; query: string; setName?: string | null }

export default async function (req: { params: Params }) {
  const { accessToken, query, setName } = req.params
  return callRpc('search_cards', accessToken, { p_query: query ?? '', p_set_name: setName ?? null, p_limit: 20 })
}
