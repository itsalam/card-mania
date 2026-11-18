import { callRpc } from './rpc'

type Params = { accessToken: string }

export default async function (req: { params: Params }) {
  return callRpc('list_cron_jobs', req.params.accessToken, {})
}
