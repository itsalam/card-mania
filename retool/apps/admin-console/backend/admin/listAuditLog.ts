import { callRpc } from './rpc'

type Params = {
  accessToken: string
}

export default async function (req: { params: Params }) {
  return callRpc('list_audit_log', req.params.accessToken, { p_limit: 100 })
}
