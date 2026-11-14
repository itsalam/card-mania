import { callRpc } from './rpc'

type Params = { accessToken: string; revisionId: number }

export default async function (req: { params: Params }) {
  const { accessToken, revisionId } = req.params
  if (!revisionId) return { ok: false as const, message: 'Revision ID is required.' }
  return callRpc('restore_promo_revision', accessToken, { p_revision_id: revisionId })
}
