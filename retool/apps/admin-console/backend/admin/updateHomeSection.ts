import { callRpc } from './rpc'

/** patch: any of title, icon, enabled, result_limit, layout, plus expected_updated_at to catch
 *  a conflicting edit. */
type Params = { accessToken: string; key: string; patch: Record<string, unknown> }

export default async function (req: { params: Params }) {
  const { accessToken, key, patch } = req.params
  return callRpc('update_home_section', accessToken, { p_key: key, p_patch: patch })
}
