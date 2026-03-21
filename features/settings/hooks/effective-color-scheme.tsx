import { useSetting, useTierValue } from '@/features/settings'

export function useEffectiveColorScheme() {
  const themeMode = useSetting('themeMode').value
  const sys = useTierValue('systemColorScheme', 'system') as 'light' | 'dark'

  if (themeMode === 'light') return 'light'
  if (themeMode === 'dark') return 'dark'
  return sys ?? 'light'
}
