import { getSupabase } from '@/lib/store/client'
import { useUserStore } from '@/lib/store/useUserStore'
import React, { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { create } from 'zustand'
import { ONBOARDING_STEPS } from './steps'
import { OnboardingStepId, TargetMeasurement } from './types'

type OnboardingStore = {
  active: boolean
  currentIndex: number
  measurements: Partial<Record<OnboardingStepId, TargetMeasurement>>
  _registry: Map<OnboardingStepId, React.RefObject<View | null>>
  start(): void
  next(): void
  back(): void
  skip(): void
  complete(): void
  registerTarget(id: OnboardingStepId, ref: React.RefObject<View | null>): void
  unregisterTarget(id: OnboardingStepId): void
  setMeasurement(id: OnboardingStepId, m: TargetMeasurement): void
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  active: false,
  currentIndex: 0,
  measurements: {},
  _registry: new Map(),

  registerTarget: (id, ref) => {
    get()._registry.set(id, ref)
  },

  unregisterTarget: (id) => {
    get()._registry.delete(id)
    set((s) => {
      const next = { ...s.measurements }
      delete next[id]
      return { measurements: next }
    })
  },

  setMeasurement: (id, m) => set((s) => ({ measurements: { ...s.measurements, [id]: m } })),

  start: () => set({ active: true, currentIndex: 0 }),

  next: () => {
    const { currentIndex } = get()
    console.log({ currentIndex, ONBOARDING_STEPS })
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      set({ currentIndex: currentIndex + 1 })
    } else {
      get().complete()
    }
  },

  back: () => {
    const { currentIndex } = get()
    if (currentIndex > 0) set({ currentIndex: currentIndex - 1 })
  },

  skip: () => get().complete(),

  complete: () => {
    set({ active: false })
    persistOnboardingComplete().catch(console.error)
  },
}))

async function checkOnboardingComplete(): Promise<boolean> {
  const user = useUserStore.getState().user
  if (!user) return true
  const { data } = await getSupabase()
    .from('user_settings')
    .select('onboarding_complete')
    .eq('user_id', user.id)
    .maybeSingle()
  return data?.onboarding_complete === true
}

async function persistOnboardingComplete(): Promise<void> {
  const user = useUserStore.getState().user
  if (!user) return
  await getSupabase()
    .from('user_settings')
    .upsert({ user_id: user.id, onboarding_complete: true }, { onConflict: 'user_id' })
}

export function OnboardingProvider() {
  const status = useUserStore((s) => s.status)
  const profileSetupComplete = useUserStore((s) => s.profileSetupComplete)
  const hasTriggered = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    if (!profileSetupComplete) return
    if (hasTriggered.current) return
    hasTriggered.current = true

    checkOnboardingComplete().then((complete) => {
      if (!complete) {
        setTimeout(() => {
          if (!useOnboardingStore.getState().active) {
            useOnboardingStore.getState().start()
          }
        }, 1200)
      }
    })
  }, [status, profileSetupComplete])

  return null
}
