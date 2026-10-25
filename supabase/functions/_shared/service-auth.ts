// Auth check for internal-only functions invoked by pg_cron with the
// service key (vault secret `edge_token`) as the bearer token.
//
// Accepts the legacy SUPABASE_SERVICE_ROLE_KEY *and* every new-style key in
// SUPABASE_SECRET_KEYS. Projects migrated to the new API keys inject an
// `sb_secret_…` key into SUPABASE_SERVICE_ROLE_KEY, so an exact match on one
// variable breaks silently whenever the vault holds a different valid key
// (legacy JWT vs. sb_secret, rotated or additional secret keys) — which is how
// card-enrichment-backfill and cleanup-anon-users 401'd on staging (ITS-40).
//
// Dependency-free, with the env lookup injectable, so it's unit-testable
// without env permissions.

type EnvGet = (name: string) => string | undefined

/** Every service key this project currently accepts. */
export function serviceKeys(env: EnvGet = (n) => Deno.env.get(n)): string[] {
  const keys = new Set<string>()
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) keys.add(legacy.trim())

  // SUPABASE_SECRET_KEYS is JSON (key name -> key); tolerate an array or a
  // bare key so a format change doesn't lock cron out.
  const raw = env('SUPABASE_SECRET_KEYS')
  const collect = (v: unknown): void => {
    if (typeof v === 'string') keys.add(v.trim())
    else if (Array.isArray(v)) v.forEach(collect)
    else if (v && typeof v === 'object') Object.values(v).forEach(collect)
  }
  if (raw) {
    try {
      collect(JSON.parse(raw))
    } catch {
      keys.add(raw.trim())
    }
  }
  return [...keys].filter(Boolean)
}

/** True when the request's bearer token is one of the project's service keys. */
export function isServiceRequest(req: Request, env?: EnvGet): boolean {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice(7).trim()
  return token.length > 0 && serviceKeys(env).some((k) => timingSafeEqual(token, k))
}

function timingSafeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length) return false
  let diff = 0
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
  return diff === 0
}
