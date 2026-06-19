/**
 * Web route protection config.
 *
 * Any pathname that starts with one of these prefixes requires the user to be
 * signed in (non-anonymous). Unauthenticated visitors are redirected to "/".
 *
 * Use the shortest unambiguous prefix — dynamic segments (/[param]) are
 * covered automatically because they share the same prefix.
 */
export const PROTECTED_ROUTE_PREFIXES = ['/offers', '/cart', '/transactions', '/settings'] as const

export type ProtectedRoutePrefix = (typeof PROTECTED_ROUTE_PREFIXES)[number]

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  )
}
