import { useCallback, useState } from 'react'

export function useRefresh(refetchFns: Array<() => Promise<unknown>>, onStart?: () => void) {
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    onStart?.()
    setRefreshing(true)
    try {
      await Promise.all(refetchFns.map((fn) => fn()))
    } finally {
      setRefreshing(false)
    }
  }, [refetchFns, onStart])
  return { refreshing, onRefresh }
}
