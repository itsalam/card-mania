import { callRpc } from './rpc'

type Params = {
  accessToken: string
}

export default async function (req: { params: Params }) {
  return callRpc('list_members', req.params.accessToken, {})
}
