import { useUserStore } from '@/lib/store/useUserStore'
import { isProtectedRoute } from '@/lib/auth/protectedRoutes'
import { usePathname, useRouter } from 'expo-router'
import { useEffect } from 'react'

/**
 * Redirects unauthenticated (or anonymous) users away from protected routes.
 * Render this as a child of the root layout so it has access to the router context.
 */
export function WebRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const hydrated = useUserStore((s) => s.hydrated)
  const user = useUserStore((s) => s.user)

  const isAuthenticated = !!user && !user.is_anonymous

  useEffect(() => {
    if (!hydrated) return
    if (isProtectedRoute(pathname) && !isAuthenticated) {
      router.replace('/')
    }
  }, [hydrated, isAuthenticated, pathname])

  return <>{children}</>
}
