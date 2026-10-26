import { reportError } from '@/lib/utils/report-error'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'

export type AuthErrorKind =
  | 'credentials'
  | 'unconfirmed'
  | 'rate_limited'
  | 'otp'
  | 'invalid_phone'
  | 'provider_disabled'
  | 'network'
  | 'internal'

export type ClassifiedAuthError = { kind: AuthErrorKind; message: string }

const MESSAGES: Record<AuthErrorKind, string> = {
  credentials: 'Incorrect email or password.',
  unconfirmed: 'Please confirm your email before signing in. Check your inbox for the link.',
  rate_limited: 'Too many attempts. Please wait a minute and try again.',
  otp: 'Incorrect or expired code. Please try again.',
  invalid_phone: 'Please enter a valid phone number.',
  provider_disabled: 'This sign-in method is unavailable right now. Please try another.',
  network: "Can't reach CardMania. Check your connection and try again.",
  internal: 'Something went wrong on our end. Please try again in a moment.',
}

function kindFor(err: unknown): AuthErrorKind {
  if (isAuthRetryableFetchError(err)) return 'network'
  const e = err as { code?: string; status?: number; message?: string } | null
  const code = e?.code ?? ''
  const msg = (e?.message ?? '').toLowerCase()

  switch (code) {
    case 'invalid_credentials':
    case 'user_not_found':
      return 'credentials'
    case 'email_not_confirmed':
    case 'phone_not_confirmed':
      return 'unconfirmed'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
      return 'rate_limited'
    case 'otp_expired':
      return 'otp'
    case 'email_provider_disabled':
    case 'phone_provider_disabled':
    case 'provider_disabled':
    case 'otp_disabled':
      return 'provider_disabled'
  }

  // Fall back to message sniffing for errors without a code (older GoTrue, fetch failures).
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) return 'credentials'
  if (msg.includes('not confirmed')) return 'unconfirmed'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'rate_limited'
  if (msg.includes('token') && (msg.includes('expired') || msg.includes('invalid'))) return 'otp'
  if (msg.includes('invalid') && (msg.includes('phone') || msg.includes('number')))
    return 'invalid_phone'
  if (msg.includes('network') || msg.includes('failed to fetch')) return 'network'

  // Anything unrecognised (5xx, unexpected_failure, hook timeouts, unknown codes) is ours to fix.
  return 'internal'
}

/**
 * Map an auth error to a friendly message. Internal / unrecognised failures are
 * reported to `client_errors` (or a dev toast) so we can see them.
 */
export function classifyAuthError(
  err: unknown,
  context: string,
  metadata?: Record<string, unknown>
): ClassifiedAuthError {
  const kind = kindFor(err)
  if (kind === 'internal') {
    const e = err as { code?: string; status?: number; name?: string } | null
    reportError({
      context,
      error: err,
      metadata: { ...metadata, code: e?.code, status: e?.status, name: e?.name },
    })
  }
  return { kind, message: MESSAGES[kind] }
}

/**
 * Phone OTP send errors that mean "stop" rather than "this number has no account yet".
 * Anything else on the first (shouldCreateUser: false) attempt falls through to auto-create.
 */
export function isBlockingPhoneError(message: string): boolean {
  const msg = message.toLowerCase()
  return (
    msg.includes('rate') ||
    msg.includes('too many') ||
    msg.includes('not enabled') ||
    msg.includes('phone provider') ||
    msg.includes('sms') ||
    msg.includes('network') ||
    msg.includes('fetch')
  )
}
