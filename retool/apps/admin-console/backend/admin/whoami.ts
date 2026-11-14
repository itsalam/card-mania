import { callRpc } from './rpc'

type Params = {
  accessToken: string
}

export default async function (req: { params: Params }) {
  return callRpc('whoami', req.params.accessToken, {})
}
