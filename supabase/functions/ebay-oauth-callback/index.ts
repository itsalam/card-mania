/**
 * eBay OAuth2 authorization code callback handler.
 *
 * Flow:
 *   1. User initiates OAuth from the app → browser opens eBay consent URL
 *   2. eBay redirects here with ?code=xxx&state=USER_ACCESS_TOKEN
 *   3. Exchange code for access + refresh tokens
 *   4. Fetch eBay username via Identity API
 *   5. Upsert into user_ebay_accounts
 *   6. Redirect to deep link: cardmania://auth/ebay?status=success&username=xxx
 */
import { createClient } from '@supabase/supabase-js'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token'
const EBAY_IDENTITY_URL = 'https://apiz.ebay.com/commerce/identity/v1/user/'
const APP_DEEP_LINK_BASE = 'cardmania://auth/ebay'

function errorRedirect(reason: string): Response {
  return Response.redirect(
    `${APP_DEEP_LINK_BASE}?status=error&reason=${encodeURIComponent(reason)}`
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') // user's Supabase access token
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    return errorRedirect(errorParam)
  }

  if (!code || !state) {
    return errorRedirect('missing_params')
  }

  const appId = Deno.env.get('EBAY_APP_ID')
  const certId = Deno.env.get('EBAY_CERT_ID')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const redirectUri = Deno.env.get('EBAY_OAUTH_REDIRECT_URI') // must match eBay developer console

  if (!appId || !certId || !supabaseUrl || !serviceRoleKey || !redirectUri) {
    console.error('Missing required environment variables')
    return errorRedirect('server_config')
  }

  // Verify the state JWT and extract the user ID
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(state)
  if (userError || !user) {
    return errorRedirect('invalid_state')
  }

  // Exchange authorization code for tokens
  const credentials = btoa(`${appId}:${certId}`)
  const tokenRes = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    console.error(`eBay token exchange failed ${tokenRes.status}: ${body.slice(0, 300)}`)
    return errorRedirect('token_exchange_failed')
  }

  const tokens = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokens

  // Fetch the eBay username via Identity API
  const identityRes = await fetch(EBAY_IDENTITY_URL, {
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!identityRes.ok) {
    const body = await identityRes.text()
    console.error(`eBay identity fetch failed ${identityRes.status}: ${body.slice(0, 300)}`)
    return errorRedirect('identity_fetch_failed')
  }

  const identity = await identityRes.json()
  const ebayUsername: string = identity.username

  if (!ebayUsername) {
    return errorRedirect('no_username')
  }

  // Upsert into user_ebay_accounts
  const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString()
  const { error: upsertError } = await supabase.from('user_ebay_accounts').upsert(
    {
      user_id: user.id,
      ebay_username: ebayUsername,
      access_token,
      refresh_token: refresh_token ?? null,
      token_expires_at: tokenExpiresAt,
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
    },
    { onConflict: 'user_id' }
  )

  if (upsertError) {
    console.error('Failed to upsert eBay account:', upsertError.message)
    return errorRedirect('db_error')
  }

  // Redirect back to app with success
  return Response.redirect(
    `${APP_DEEP_LINK_BASE}?status=success&username=${encodeURIComponent(ebayUsername)}`
  )
})
