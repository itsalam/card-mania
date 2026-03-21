import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useStore } from 'zustand'
import { LocalAdapter } from './adapters/local-adapter'
import { RemoteAdapter } from './adapters/remote-adapter'
import { SystemAdapter, SystemState } from './adapters/system-adapter'
import { defaultResolver } from './registry/helpers'
import { createSettingsStore, SettingsStoreState } from './store'
import {
  InferSettingValue,
  SettingDescriptor,
  SettingsRegistry,
  SettingsSnapshot,
  SettingTier,
} from './types'

type ProviderState<R extends SettingsRegistry> = {
  hydrated: boolean
  system: SystemState
  local: Record<string, unknown>
  remote: Record<string, unknown>
  effective: SettingsSnapshot<R>
}

type Action =
  | {
      type: 'HYDRATE'
      system: SystemState
      local: Record<string, unknown>
      remote: Record<string, unknown>
    }
  | { type: 'SET_LOCAL'; key: string; value: unknown }
  | { type: 'SET_REMOTE'; key: string; value: unknown }
  | { type: 'SET_SYSTEM_SNAPSHOT'; system: SystemState }

/* Computes the effective value from the available states depending on the resolver found in the registry (if found) */
function computeEffective<R extends SettingsRegistry>(
  registry: R,
  system: SystemState,
  local: Record<string, unknown>,
  remote: Record<string, unknown>
): SettingsSnapshot<R> {
  const out: any = {}
  for (const key in registry) {
    const desc = registry[key] as SettingDescriptor<any>

    // Pull tier values only if tier is enabled for the descriptor:
    const sysVal = desc.tiers.includes('system') ? (system[key] as any) : undefined
    const localVal = desc.tiers.includes('local') ? (local[key] as any) : undefined
    const remoteVal = desc.tiers.includes('remote') ? (remote[key] as any) : undefined

    const resolver = desc.resolve ?? defaultResolver
    const resolved = resolver({
      system: sysVal,
      local: localVal,
      remote: remoteVal,
      defaultValue: desc.defaultValue,
    })

    out[key] = resolved
  }
  return out
}

function validateIfNeeded<T>(desc: SettingDescriptor<T>, value: unknown): T | undefined {
  if (!desc.validate) return value as T
  return desc.validate(value) ? (value as T) : undefined
}

type SettingsContextValue<R extends SettingsRegistry> = {
  hydrated: boolean
  effective: SettingsSnapshot<R>

  /** Read raw tier value (rarely needed) */
  getTier: <K extends keyof R>(key: K, tier: SettingTier) => InferSettingValue<R, K> | undefined

  /** Set preference into a tier (most common: local; sometimes remote) */
  setTier: <K extends keyof R>(
    key: K,
    tier: Extract<SettingTier, 'local' | 'remote'>,
    value: InferSettingValue<R, K> | undefined
  ) => Promise<void>

  /** Convenience: set local then optionally remote depending on descriptor */
  set: <K extends keyof R>(key: K, value: InferSettingValue<R, K>) => Promise<void>
}

type StoreApi = ReturnType<typeof createSettingsStore>

const SettingsStoreContext = createContext<StoreApi | null>(null)

export function createSettingsProvider<R extends SettingsRegistry>(registry: R) {
  type Props = {
    children: React.ReactNode
    localAdapter: LocalAdapter
    systemAdapter: SystemAdapter
    remoteAdapter?: RemoteAdapter
    /** whether remote is enabled (e.g. logged in) */
    remoteEnabled?: boolean
  }

  function Provider({
    children,
    localAdapter,
    systemAdapter,
    remoteAdapter,
    remoteEnabled = false,
  }: Props) {
    const storeRef = useRef<StoreApi | null>(null)

    if (!storeRef.current) {
      storeRef.current = createSettingsStore({
        registry,
        localAdapter,
        remoteAdapter,
        remoteEnabled,
      })
    } else {
      //TODO:
      // runtime flags may change (login/logout). In a more advanced version,
      // you’d keep runtime in the store and update it. For simplicity:
      // recreate provider on auth boundary, OR lift provider above auth and
      // keep remoteEnabled stable.
    }
    // debounce timers for remote patches per-key
    const remoteTimers = useRef<Record<string, any>>({})
    const pendingRemote = useRef<Record<string, unknown>>({})

    useEffect(() => {
      let cancelled = false

      const localKeys = Object.keys(registry).filter((k) => registry[k].tiers.includes('local'))
      ;(async () => {
        const [systemSnap, localSnap] = await Promise.all([
          systemAdapter.getSnapshot(),
          localAdapter.getMany(localKeys),
        ])

        let remoteSnap: Record<string, unknown> = {}
        if (remoteEnabled && remoteAdapter) {
          try {
            remoteSnap = await remoteAdapter.fetch()
          } catch {
            remoteSnap = {}
          }
        }

        // Validate snapshots against descriptors (optional)
        const validatedLocal: Record<string, unknown> = {}
        const validatedRemote: Record<string, unknown> = {}
        for (const key in registry) {
          const d = registry[key] as SettingDescriptor<any>

          if (d.tiers.includes('local') && key in localSnap) {
            const v = validateIfNeeded(d, localSnap[key])
            if (v !== undefined) validatedLocal[key] = v
          }
          if (d.tiers.includes('remote') && key in remoteSnap) {
            const v = validateIfNeeded(d, remoteSnap[key])
            if (v !== undefined) validatedRemote[key] = v
          }
        }

        if (!cancelled) {
          const store = storeRef.current!
          store.setState((s) => ({
            hydrated: true,
            tier: {
              system: systemSnap,
              local: localSnap,
              remote: remoteSnap,
            },
          }))
        }
      })()

      const unsubSystem = systemAdapter.subscribe(async () => {
        const systemSnap = await systemAdapter.getSnapshot()
        storeRef.current?.getState().setSystemSnapshot(systemSnap)
      })

      let unsubRemote: undefined | (() => void)
      if (remoteEnabled && remoteAdapter?.subscribe) {
        unsubRemote = remoteAdapter.subscribe(async () => {
          try {
            const remoteSnap = await remoteAdapter.fetch()
            const store = storeRef.current!
            store.setState((s) => ({ tier: { ...s.tier, remote: remoteSnap } }))
          } catch {}
        })
      }

      return () => {
        cancelled = true
        unsubSystem()
        unsubRemote?.()
      }
    }, [localAdapter, systemAdapter, remoteAdapter, remoteEnabled])

    const store = storeRef.current!
    const ctxValue = useMemo(() => store, [store])

    return (
      <SettingsStoreContext.Provider value={ctxValue}>{children}</SettingsStoreContext.Provider>
    )
  }

  function useSettingsStore<T>(selector: (s: SettingsStoreState) => T) {
    const api = useContext(SettingsStoreContext)
    if (!api) throw new Error('useSettingsStore must be used inside Settings Provider')
    return useStore(api, selector)
  }

  return { Provider, registry, useSettingsStore }
}
