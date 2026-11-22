import { callRpc } from './rpc'

/** Sets one endpoint class's daily CardHedger limit (and optionally the scheduled share). Audited. */
type Params = {
  accessToken: string
  endpointClass: string
  dailyLimit: number
  scheduledShare?: number
}

export default async function (req: { params: Params }) {
  const { accessToken, endpointClass, dailyLimit, scheduledShare } = req.params
  return callRpc('set_cardhedger_budget', accessToken, {
    p_class: endpointClass,
    p_daily_limit: dailyLimit,
    p_scheduled_share: scheduledShare ?? null,
  })
}
