import { callRpc } from './rpc'

type Params = { accessToken: string }

export default async function (req: { params: Params }) {
  return callRpc('list_home_sections', req.params.accessToken, {})
}
