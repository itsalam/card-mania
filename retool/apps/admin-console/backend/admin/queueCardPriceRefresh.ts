import { callRpc } from './rpc'

/** Makes one tracked card due on the next price refresh run. Audited. */
type Params = { accessToken: string; cardId: string }

export default async function (req: { params: Params }) {
  const { accessToken, cardId } = req.params
  return callRpc('queue_card_price_refresh', accessToken, { p_card_id: cardId })
}
