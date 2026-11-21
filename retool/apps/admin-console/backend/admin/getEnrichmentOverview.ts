import { callRpc } from './rpc'

type Params = { accessToken: string }

export default async function (req: { params: Params }) {
  return callRpc('enrichment_overview', req.params.accessToken, {})
}
