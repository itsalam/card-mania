import { callRpc } from './rpc'

type Params = { accessToken: string; context: string | null; hours?: number; limit?: number }

export default async function (req: { params: Params }) {
  const { accessToken, context, hours, limit } = req.params
  return callRpc('list_client_errors', accessToken, {
    p_context: context,
    p_hours: hours ?? 24,
    p_limit: limit ?? 100,
  })
}
