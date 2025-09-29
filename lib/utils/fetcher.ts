type FetchJSONOpts = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
  cacheKey?: string // for in-flight de-dupe
}

const inflight = new Map<string, Promise<any>>()

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function fetchJSON<T>(path: string, opts: FetchJSONOpts = {}): Promise<T> {
  const {
    method = 'GET',
    headers = {},
    body,
    signal,
    timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS),
    retries = Number(process.env.RETRY_COUNT),
    retryDelayMs = 350,
    cacheKey,
  } = opts

  const url = `${process.env.API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const key = cacheKey ?? `${method}:${url}:${body ? JSON.stringify(body) : ''}`

  if (inflight.has(key)) {
    return inflight.get(key)! as Promise<T>
  }

  const runner = (async () => {
    let attempt = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++
      const ac = new AbortController()
      const timeout = setTimeout(() => ac.abort(), timeoutMs)
      try {
        const res = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json', ...headers },
          body: body ? JSON.stringify(body) : undefined,
          signal: signal ?? ac.signal,
        })
        clearTimeout(timeout)

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          // 5xx and network-ish errors are retryable; 4xx not
          if (res.status >= 500 && attempt <= retries + 1) {
            await sleep(retryDelayMs * attempt)
            continue
          }
          throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
        }
        return (await res.json()) as T
      } catch (err: any) {
        clearTimeout(timeout)
        const msg = String(err?.message ?? err)
        const retryable =
          msg.includes('network') || msg.includes('timeout') || err?.name === 'AbortError'
        if (retryable && attempt <= retries + 1) {
          await sleep(retryDelayMs * attempt)
          continue
        }
        throw err
      }
    }
  })()

  inflight.set(key, runner)
  try {
    return await runner
  } finally {
    inflight.delete(key)
  }
}
