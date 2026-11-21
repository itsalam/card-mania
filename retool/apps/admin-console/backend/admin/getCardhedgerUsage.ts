import { callRpc } from './rpc'

/** CardHedger budget, today's usage by caller, the 30-day trend, recent failures and alerts. */
type Params = { accessToken: string }

export default async function (req: { params: Params }) {
  return callRpc('cardhedger_usage_overview', req.params.accessToken, {})
}
