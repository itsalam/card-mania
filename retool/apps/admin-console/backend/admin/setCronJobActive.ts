import { callRpc } from './rpc'

/** Pauses (active: false) or resumes a pg_cron job. Audited. */
type Params = { accessToken: string; jobname: string; active: boolean }

export default async function (req: { params: Params }) {
  const { accessToken, jobname, active } = req.params
  return callRpc('set_cron_job_active', accessToken, { p_jobname: jobname, p_active: active })
}
