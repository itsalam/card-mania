import { callRpc } from './rpc'

/** Ranks a query with the current and the proposed search_config values side by side. Saves nothing. */
type Params = {
  accessToken: string
  query: string
  changes: Record<string, number | string[]>
  limit?: number
}

export default async function (req: { params: Params }) {
  const { accessToken, query, changes, limit } = req.params
  return callRpc('preview_search_config', accessToken, {
    p_query: query,
    p_changes: changes,
    p_limit: limit ?? 20,
  })
}
