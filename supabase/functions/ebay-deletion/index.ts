/**
 * ebay-deletion — eBay Marketplace Account Deletion notification handler.
 *
 * Required for eBay production Browse API access (GDPR/policy compliance).
 * https://developer.ebay.com/marketplace-account-deletion
 *
 * GET  /functions/v1/ebay-deletion?challenge_code=<code>
 *   → { challengeResponse: "<hex>" }  (SHA-256 of code+token+url, hex-encoded)
 *
 * POST /functions/v1/ebay-deletion
 *   Receives MARKETPLACE_ACCOUNT_DELETION notifications.
 *   Verifies eBay's RSA-SHA256 signature, then purges all eBay provider cache
 *   rows (we don't store seller IDs, so a full eBay cache flush is the compliant
 *   approach — the cache repopulates on next search).
 *
 * Required secrets:
 *   EBAY_DELETION_VERIFICATION_TOKEN  — set in eBay Developer Portal when registering endpoint
 *   EBAY_DELETION_ENDPOINT_URL        — the public URL of this function (e.g. https://…/ebay-deletion)
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createSupabaseServiceClient } from '@utils'

const VERIFICATION_TOKEN = Deno.env.get('EBAY_DELETION_VERIFICATION_TOKEN') ?? ''
const ENDPOINT_URL = Deno.env.get('EBAY_DELETION_ENDPOINT_URL') ?? ''

// eBay's public key endpoint for notification signature verification
const EBAY_KEY_BASE = 'https://api.ebay.com/commerce/notification/v1/public_key'

const headers = { 'content-type': 'application/json' }

// SHA-256(challengeCode + verificationToken + endpointUrl) as lowercase hex
async function challengeResponse(code: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(code + VERIFICATION_TOKEN + ENDPOINT_URL)
  )
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Verify eBay's RSA-SHA256 signature over the raw request body.
// X-EBAY-SIGNATURE header is JSON: { kid: string, signature: string (base64) }
async function verifyEbaySignature(rawBody: string, sigHeader: string): Promise<boolean> {
  try {
    const { kid, signature } = JSON.parse(sigHeader) as { kid: string; signature: string }

    const keyRes = await fetch(`${EBAY_KEY_BASE}/${encodeURIComponent(kid)}`)
    if (!keyRes.ok) {
      console.error(`Failed to fetch eBay public key ${kid}: ${keyRes.status}`)
      return false
    }
    const { key: pemKey } = (await keyRes.json()) as { key: string }

    // Strip PEM headers and decode
    const b64 = pemKey.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
    const keyBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      keyBytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0))
    const bodyBytes = new TextEncoder().encode(rawBody)
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, bodyBytes)
  } catch (err) {
    console.error('Signature verification error:', err)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  const url = new URL(req.url)

  // ── GET: challenge verification ──────────────────────────────────────────────
  if (req.method === 'GET') {
    const code = url.searchParams.get('challenge_code')
    if (!code) return new Response('Missing challenge_code', { status: 400 })
    if (!VERIFICATION_TOKEN || !ENDPOINT_URL) {
      console.error('EBAY_DELETION_VERIFICATION_TOKEN or EBAY_DELETION_ENDPOINT_URL not set')
      return new Response('Endpoint not configured', { status: 500 })
    }
    return new Response(JSON.stringify({ challengeResponse: await challengeResponse(code) }), {
      headers,
    })
  }

  // ── POST: deletion notification ──────────────────────────────────────────────
  if (req.method === 'POST') {
    const rawBody = await req.text()
    const sigHeader = req.headers.get('x-ebay-signature') ?? ''

    if (sigHeader) {
      const valid = await verifyEbaySignature(rawBody, sigHeader)
      if (!valid) {
        console.warn('eBay deletion: invalid signature, rejecting')
        return new Response('Invalid signature', { status: 401 })
      }
    } else {
      // eBay always sends a signature for real notifications; missing = suspicious
      console.warn('eBay deletion: no X-EBAY-SIGNATURE header present')
    }

    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    const topic = (payload as any)?.metadata?.topic
    if (topic !== 'MARKETPLACE_ACCOUNT_DELETION') {
      // Acknowledge unknown topics gracefully — eBay may send other notification types
      return new Response(null, { status: 200 })
    }

    const { userId, username } = (payload as any)?.notification?.data ?? {}
    console.info(`eBay account deletion received: userId=${userId} username=${username}`)

    // Purge all eBay provider cache — we don't store seller IDs on cached items
    // so a full flush is the correct approach; it repopulates on next search.
    const supabase = createSupabaseServiceClient()
    const { error } = await supabase.from('provider_search_cache').delete().eq('provider', 'ebay')

    if (error) {
      console.error('Failed to purge eBay provider cache:', error)
      // Still return 200 — eBay will retry on 5xx but not on 4xx/2xx
      return new Response(null, { status: 200 })
    }

    console.info(
      `eBay provider cache purged for account deletion: userId=${userId} username=${username}`
    )
    return new Response(null, { status: 200 })
  }

  return new Response('Method Not Allowed', { status: 405 })
})
