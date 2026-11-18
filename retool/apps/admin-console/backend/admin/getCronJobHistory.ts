import { callRpc } from './rpc'

type Params = { accessToken: string; jobname: string; limit?: number }

export default async function (req: { params: Params }) {
  const { accessToken, jobname, limit } = req.params
  return callRpc('cron_job_history', accessToken, { p_jobname: jobname, p_limit: limit ?? 50 })
}
