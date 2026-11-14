import { callRpc } from './rpc'

const ROLES = ['owner', 'editor', 'ops'] as const

type Params = {
  accessToken: string
  p_email: string
  p_role: string
}

export default async function (req: { params: Params }) {
  const { accessToken, p_email, p_role } = req.params
  if (!p_email) return { ok: false as const, message: 'Email is required.' }
  if (!ROLES.includes(p_role as (typeof ROLES)[number])) {
    return { ok: false as const, message: 'Role must be one of owner, editor, or ops.' }
  }
  return callRpc('set_member_role', accessToken, { p_email, p_role })
}
