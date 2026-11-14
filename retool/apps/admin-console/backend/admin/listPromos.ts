import { callRpc } from './rpc'

type Params = { accessToken: string; includeArchived?: boolean }

export default async function (req: { params: Params }) {
  const { accessToken, includeArchived } = req.params
  return callRpc('list_promos', accessToken, { p_include_archived: includeArchived === true })
}
