import { callRpc } from './rpc'

type Params = { accessToken: string; hours?: number }

export default async function (req: { params: Params }) {
  const { accessToken, hours } = req.params
  return callRpc('notification_overview', accessToken, { p_hours: hours ?? 168 })
}
