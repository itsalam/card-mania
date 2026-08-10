import { patchOnboardingState } from '@/lib/store/onboardingState'
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
    persistTourComplete().catch(console.error)
  },
}))

async function persistTourComplete(): Promise<void> {
  const user = useUserStore.getState().user
  if (!user) return
  const next = await patchOnboardingState(user.id, { tour: true })
  useUserStore.setState({ onboardingState: next })
}

export function OnboardingProvider() {
  const status = useUserStore((s) => s.status)
  const profileSetupComplete = useUserStore((s) => s.profileSetupComplete)
  const tourComplete = useUserStore((s) => s.onboardingState?.tour === true)
  const hasTriggered = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    if (!profileSetupComplete) return
    if (hasTriggered.current) return
    hasTriggered.current = true

    if (!tourComplete) {
      setTimeout(() => {
        if (!useOnboardingStore.getState().active) {
          useOnboardingStore.getState().start()
        }
      }, 1200)
    }
  }, [status, profileSetupComplete, tourComplete])

  return null
}
