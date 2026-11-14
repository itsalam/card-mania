/**
 * Shared helper for calling Supabase PostgREST RPCs through the
 * card-mania-staging resource (which supplies the configured apikey header).
 * Every admin call is a POST to /rest/v1/rpc/<name> with a Bearer access
 * token and the admin content profile.
 */

export type RpcResult<T> = { ok: true; data: T } | { ok: false; code?: string; message: string }

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
      return { ok: false, code: extractCode(data), message: extractMessage(data) }
    }
    return { ok: true, data }
  } catch (err) {
    const message = errorMessage(err)
    // If rawRequest throws on a 401 instead of resolving, keep the expiry detectable.
    return { ok: false, code: /jwt expired/i.test(message) ? 'PGRST303' : undefined, message }
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

/** PostgREST / Postgres error code, e.g. '42501' (not authorized), 'PGRST303' (JWT expired). */
function extractCode(data: unknown): string | undefined {
  const code = (data as Record<string, unknown>)['code']
  return code === undefined || code === null ? undefined : String(code)
}

function extractMessage(data: unknown): string {
  const obj = data as Record<string, unknown>
  return typeof obj['message'] === 'string' ? obj['message'] : 'Request failed'
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return String(err)
}
