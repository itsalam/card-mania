import { callRpc } from './rpc'

/** keys: every section key, in the new display order. */
type Params = { accessToken: string; keys: string[] }

export default async function (req: { params: Params }) {
  const { accessToken, keys } = req.params
  return callRpc('reorder_home_sections', accessToken, { p_keys: keys })
}
