import { useSetting } from '@/features/settings'
import React from 'react'

function getSystemScheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useEffectiveColorScheme() {
  const themeMode = useSetting('themeMode').value
  const [sys, setSys] = React.useState<'light' | 'dark'>(getSystemScheme)

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setSys(getSystemScheme())
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  if (themeMode === 'light') return 'light'
  if (themeMode === 'dark') return 'dark'
  return sys
}
