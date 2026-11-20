import { callRpc } from './rpc'

type Params = { accessToken: string; hours?: number }

export default async function (req: { params: Params }) {
  const { accessToken, hours } = req.params
  return callRpc('client_error_groups', accessToken, { p_hours: hours ?? 24 })
}
