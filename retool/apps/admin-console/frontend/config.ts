/** Supabase project the console talks to (staging). Used only to build public image URLs. */
export const SUPABASE_URL = 'https://zijgqgpwmqrgnzcictcb.supabase.co'

/**
 * Base URL of the app's web build, for the phone preview iframe (/preview/promo/[id]?token=…).
 * Empty until ITS-192 ships that route; the editor then shows its own mock-up instead.
 */
export const APP_PREVIEW_BASE_URL: string = ''
