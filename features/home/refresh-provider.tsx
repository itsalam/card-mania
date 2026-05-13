import { useQueryClient } from '@tanstack/react-query'
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

type Handler = () => Promise<unknown> | unknown

interface HomeRefreshContextValue {
  subscribe: (fn: Handler) => () => void
  refreshing: boolean
  onRefresh: () => Promise<void>
}

const HomeRefreshContext = createContext<HomeRefreshContextValue | null>(null)

export function HomeRefreshProvider({
  children,
  onStart,
}: PropsWithChildren<{ onStart?: () => void }>) {
  const subscribers = useRef<Set<Handler>>(new Set())
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const subscribe = useCallback((fn: Handler) => {
    subscribers.current.add(fn)
    return () => subscribers.current.delete(fn)
  }, [])

  const onRefresh = useCallback(async () => {
    onStart?.()
    setRefreshing(true)
    try {
      await Promise.all([
        qc.refetchQueries({ type: 'active' }),
        ...[...subscribers.current].map((fn) => fn()),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [qc, onStart])

  return (
    <HomeRefreshContext.Provider value={{ subscribe, refreshing, onRefresh }}>
      {children}
    </HomeRefreshContext.Provider>
  )
}

/** Wire into <RefreshControl refreshing={...} onRefresh={...} />. */
export function useHomeRefreshControl() {
  const ctx = useContext(HomeRefreshContext)
  if (!ctx) throw new Error('useHomeRefreshControl must be inside HomeRefreshProvider')
  return { refreshing: ctx.refreshing, onRefresh: ctx.onRefresh }
}

/**
 * Subscribe a handler to the home pull-to-refresh cycle.
 * No-op when called outside the provider — safe to use in shared components.
 * The handler ref is kept current so stale closures are never called.
 */
export function useRefreshSubscribe(fn: Handler) {
  const ctx = useContext(HomeRefreshContext)
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    if (!ctx) return
    return ctx.subscribe(() => fnRef.current())
  }, [ctx])
}
