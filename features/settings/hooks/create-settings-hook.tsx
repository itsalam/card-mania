import type { InferSettingValue, SettingsRegistry, UseSettingsStore } from '../types'

export function createSettingsHooks<R extends SettingsRegistry>(
  useSettingsStore: UseSettingsStore
) {
  function useHydrated() {
    return useSettingsStore((s: any) => s.hydrated) as boolean
  }

  function useSetting<K extends keyof R>(key: K) {
    const hydrated = useHydrated()

    const value = useSettingsStore((s: any) => s.getEffective(String(key))) as InferSettingValue<
      R,
      K
    >

    const setTier = useSettingsStore((s) => s.setTier)
    const tier = useSettingsStore((s) => s.tier)

    const setLocal = (v: InferSettingValue<R, K>) => setTier(String(key), 'local', v)

    const setRemote = (v: InferSettingValue<R, K>) => setTier(String(key), 'remote', v)

    // common convenience: write local if it exists, and remote if it exists
    const set = async (v: InferSettingValue<R, K>) => {
      const d = tier // not registry; keep it simple:
      // Instead, just call both; registry-tier checks happen in setTier validation layer.
      await setTier(String(key), 'local', v)
      await setTier(String(key), 'remote', v)
    }

    return { hydrated, value, set, setLocal, setRemote }
  }

  function useTierValue(key: keyof R, tier: 'system' | 'local' | 'remote') {
    return useSettingsStore((s: any) => s.tier[tier][String(key)])
  }

  return { useSetting, useHydrated, useTierValue }
}
