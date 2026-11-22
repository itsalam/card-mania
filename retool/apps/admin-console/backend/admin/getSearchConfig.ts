import { callRpc } from './rpc'

/** Current search_config values, the editable fields with their bounds, and the last 20 changes. */
type Params = { accessToken: string }

export default async function (req: { params: Params }) {
  return callRpc('search_config_get', req.params.accessToken, {})
}
