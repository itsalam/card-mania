// deno-lint-ignore-file no-explicit-any
type ImageFetchOptions = {
  timeoutMs?: number
  maxBytes?: number
  retries?: number
  userAgent?: string
  referer?: string // default = origin of target URL
}

const DEFAULTS = {
  timeoutMs: 15_000,
  maxBytes: 8 * 1024 * 1024, // 8MB
  retries: 2,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
}

function hex(bytes: Uint8Array, n: number) {
  return Array.from(bytes.slice(0, n))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function sniffMime(buf: Uint8Array): string | null {
  const h3 = hex(buf, 3).toUpperCase()
  const h4 = hex(buf, 4).toUpperCase()
  const h12 = hex(buf, 12).toUpperCase()
  if (h3.startsWith('FFD8FF')) return 'image/jpeg'
  if (h4 === '89504E47') return 'image/png'
  if (h4 === '47494638') return 'image/gif'
  // RIFF....WEBP
  if (h12.startsWith('52494646') && h12.slice(16, 24) === '57454250') return 'image/webp'
  // ftypavif
  if (h12.startsWith('6674797061766966')) return 'image/avif'
  // quick SVG sniff
  const txt = new TextDecoder().decode(buf.slice(0, 512)).trim().toLowerCase()
  if (txt.startsWith('<svg') || (txt.startsWith('<?xml') && txt.includes('<svg'))) {
    return 'image/svg+xml'
  }
  return null
}

async function readWithCap(res: Response, maxBytes: number): Promise<Uint8Array> {
  // In Deno Edge, res.body is a ReadableStream
  const reader = res.body?.getReader?.()
  if (!reader) {
    const ab = await res.arrayBuffer()
    const bytes = new Uint8Array(ab)
    if (bytes.byteLength > maxBytes) throw new Error('Image too large')
    return bytes
  }
  const chunks: Uint8Array[] = []
  let received = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) {
      received += value.byteLength
      if (received > maxBytes) {
        reader.cancel()
        throw new Error('Image too large')
      }
      chunks.push(value)
    }
  }
  const out = new Uint8Array(received)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.byteLength
  }
  return out
}

export async function fetchImageStrict(rawUrl: string, opts: ImageFetchOptions = {}) {
  const { timeoutMs, maxBytes, retries, userAgent } = { ...DEFAULTS, ...opts }
  let referer = opts.referer
  let url = rawUrl
  const visited = new Set<string>()

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const u = new URL(url)
      if (!referer) referer = `${u.protocol}//${u.host}/`

      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ac.signal,
        headers: {
          Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': userAgent,
          Referer: referer,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      })
      clearTimeout(timer)

      // Detect redirect loops (fetch already follows)
      if (res.redirected) {
        if (visited.has(res.url)) throw new Error('Redirect loop')
        visited.add(res.url)
        url = res.url
      }

      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)

      const headerCt = (res.headers.get('content-type') || '').toLowerCase()
      const bytes = await readWithCap(res, maxBytes)
      const mime =
        sniffMime(bytes) || (headerCt.startsWith('image/') ? headerCt.split(';')[0] : null)
      if (!mime) throw new Error(`Not an image payload (content-type=${headerCt || 'unknown'})`)

      return { bytes, mime, finalUrl: res.url }
    } catch (e) {
      clearTimeout(timer)
      // adaptive retry: toggle Referer, relax headers, small backoff
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
        // 1st retry: drop Referer (some sites require NONE)
        if (attempt === 0) referer = ''
        // 2nd retry: simpler UA
        if (attempt === 1) (opts.userAgent as any) = 'Mozilla/5.0'
        continue
      }
      throw e
    }
  }
  throw new Error('unreachable')
}
