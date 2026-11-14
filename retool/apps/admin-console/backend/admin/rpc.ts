/**
 * Shared helper for calling Supabase PostgREST RPCs through the
 * card-mania-staging resource (which supplies the configured apikey header).
 * Every admin call is a POST to /rest/v1/rpc/<name> with a Bearer access
 * token and the admin content profile.
 */

export type RpcResult<T> = { ok: true; data: T } | { ok: false; message: string }

export async function callRpc<T = unknown>(
  name: string,
  accessToken: string,
  body: unknown,
): Promise<RpcResult<T>> {
  try {
    const res = await cardManiaStaging.rawRequest<T>({
      path: `/rest/v1/rpc/${name}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Profile': 'admin',
      },
      bodyType: 'json',
      body,
    })
    const data = res.data
    if (isApiError(data)) {
      return { ok: false, message: extractMessage(data) }
    }
    return { ok: true, data }
  } catch (err) {
    return { ok: false, message: errorMessage(err) }
  }
}

/** PostgREST errors resolve as objects with a string `code` and `message`. */
function isApiError(data: unknown): boolean {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return false
  const obj = data as Record<string, unknown>
  return (
    (typeof obj['code'] === 'string' || typeof obj['code'] === 'number') &&
    typeof obj['message'] === 'string'
  )
}

function extractMessage(data: unknown): string {
  const obj = data as Record<string, unknown>
  return typeof obj['message'] === 'string' ? obj['message'] : 'Request failed'
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return String(err)
}
