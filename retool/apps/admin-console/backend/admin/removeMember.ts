import { callRpc } from './rpc'

type Params = {
  accessToken: string
  p_user_id: string
}

export default async function (req: { params: Params }) {
  const { accessToken, p_user_id } = req.params
  if (!p_user_id) return { ok: false as const, message: 'User ID is required.' }
  return callRpc('remove_member', accessToken, { p_user_id })
}
