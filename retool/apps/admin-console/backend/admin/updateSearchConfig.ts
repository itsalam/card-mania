import { callRpc } from './rpc'

/** Saves the given search_config fields (only those passed), with an optional reason. Audited. */
type Params = {
  accessToken: string
  changes: Record<string, number | string[]>
  reason?: string
}

export default async function (req: { params: Params }) {
  const { accessToken, changes, reason } = req.params
  return callRpc('update_search_config', accessToken, {
    p_changes: changes,
    p_reason: reason ?? null,
  })
}
