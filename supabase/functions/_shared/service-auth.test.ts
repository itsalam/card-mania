// Run: deno test supabase/functions/_shared/service-auth.test.ts
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert@1'
import { isServiceRequest, serviceKeys } from './service-auth.ts'

const env =
  (vars: Record<string, string>) =>
  (name: string): string | undefined =>
    vars[name]
const req = (auth?: string) =>
  new Request('http://x', { headers: auth ? { Authorization: auth } : {} })

const LEGACY = 'eyJhbGciOiJIUzI1NiJ9.legacy.sig'
const SECRET = 'sb_secret_default'
const SECRET2 = 'sb_secret_rotated'
const migrated = env({
  SUPABASE_SERVICE_ROLE_KEY: SECRET,
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET, rotated: SECRET2 }),
})

Deno.test('collects the legacy key and every key in SUPABASE_SECRET_KEYS, deduped', () => {
  const keys = serviceKeys(
    env({
      SUPABASE_SERVICE_ROLE_KEY: LEGACY,
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET }),
    })
  )
  assertEquals(keys.sort(), [LEGACY, SECRET].sort())
  assertEquals(serviceKeys(migrated).sort(), [SECRET, SECRET2].sort())
})

Deno.test('tolerates SUPABASE_SECRET_KEYS as an array or a bare key', () => {
  assertEquals(serviceKeys(env({ SUPABASE_SECRET_KEYS: JSON.stringify([SECRET]) })), [SECRET])
  assertEquals(serviceKeys(env({ SUPABASE_SECRET_KEYS: SECRET })), [SECRET])
})

Deno.test('accepts any configured service key as the bearer token', () => {
  assert(isServiceRequest(req(`Bearer ${SECRET}`), migrated))
  assert(isServiceRequest(req(`Bearer ${SECRET2}`), migrated))
  assert(isServiceRequest(req(`Bearer ${LEGACY}`), env({ SUPABASE_SERVICE_ROLE_KEY: LEGACY })))
})

Deno.test('rejects missing, malformed, empty and unknown tokens', () => {
  assertFalse(isServiceRequest(req(), migrated))
  assertFalse(isServiceRequest(req(SECRET), migrated)) // no "Bearer " prefix
  assertFalse(isServiceRequest(req('Bearer '), migrated))
  assertFalse(isServiceRequest(req('Bearer sb_secret_wrong'), migrated))
  // the local CLI's demo key — what staging's vault held during the ITS-40 incident
  assertFalse(isServiceRequest(req(`Bearer ${LEGACY}`), migrated))
})

Deno.test('rejects everything when no keys are configured', () => {
  assertFalse(isServiceRequest(req('Bearer anything'), env({})))
})
