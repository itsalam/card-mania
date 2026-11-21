import { callRpc } from './rpc'

type Params = { accessToken: string }

export default async function (req: { params: Params }) {
  return callRpc('price_refresh_overview', req.params.accessToken, {})
}
