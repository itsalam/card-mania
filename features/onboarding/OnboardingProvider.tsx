import { patchOnboardingState } from '@/lib/store/onboardingState'
import { useUserStore } from '@/lib/store/useUserStore'
import React, { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { create } from 'zustand'
import { TOURS } from './steps'
import { OnboardingStepId, TargetMeasurement, TourId } from './types'

type OnboardingStore = {
  active: boolean
  tourId: TourId
  currentIndex: number
  measurements: Partial<Record<OnboardingStepId, TargetMeasurement>>
  _registry: Map<OnboardingStepId, React.RefObject<View | null>>
  start(tourId?: TourId): void
  /** Reopens the overlay at wherever this tour last left off (in-memory currentIndex) if it's
   *  already been engaged this session, rather than start()'s hard reset to step 0 — "start the
   *  next section" from a dropped/dismissed overlay, not restart from the beginning. Falls back
   *  to start() for a tour that's never been touched yet (currentIndex still at its pristine
   *  default). Use this for anything that (re-)opens a tour a user may already be partway
   *  through — the natural first-visit trigger and the debug double-tap alike. */
  resumeOrStart(tourId: TourId): void
  next(): void
  back(): void
  skip(): void
  complete(): void
  /** Advances the tour only if its current step is `id` — a no-op otherwise, so it's always
   *  safe to call from an action that may or may not correspond to the pending step. Lets a
   *  real user action (tapping "+", saving a collection, tapping Add) drive the tour forward
   *  across screen navigations, instead of requiring the overlay's own Next button. Works
   *  whether the overlay is currently showing or was dropped/dismissed — the action itself is
   *  the source of truth for progress, not overlay visibility, and calling this (re-)activates
   *  the overlay so the next step's spotlight appears. */
  advanceIfCurrentStep(id: OnboardingStepId): void
  registerTarget(id: OnboardingStepId, ref: React.RefObject<View | null>): void
  unregisterTarget(id: OnboardingStepId): void
  setMeasurement(id: OnboardingStepId, m: TargetMeasurement): void
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  active: false,
  tourId: 'main',
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

  start: (tourId = 'main') => set({ active: true, tourId, currentIndex: 0, measurements: {} }),

  resumeOrStart: (tourId) => {
    const s = get()
    if (s.tourId === tourId && s.currentIndex >= 0) {
      // In-progress (or dropped mid-tour) — reopen at the current step rather than resetting.
      set({ active: true })
    } else {
      // Never engaged this session, or fully completed (complete() sets currentIndex: -1) —
      // nothing to resume, so this is what "the next section" actually is: the beginning.
      get().start(tourId)
    }
  },

  next: () => {
    const { currentIndex, tourId } = get()
    const steps = TOURS[tourId]
    if (currentIndex < steps.length - 1) {
      set({ currentIndex: currentIndex + 1 })
    } else {
      get().complete()
    }
  },

  back: () => {
    const { currentIndex } = get()
    if (currentIndex > 0) set({ currentIndex: currentIndex - 1 })
  },

  skip: () => {
    const { tourId, currentIndex } = get()
    const step = TOURS[tourId][currentIndex]
    if (step?.advanceByAction) {
      // This step's real trigger is a user action elsewhere (e.g. pressing "+"), not this
      // panel — Skip here just means "not right now", not "done with this tour". Hide the
      // overlay only, keeping currentIndex/tourId intact so advanceIfCurrentStep can still match
      // and resume this exact step whenever that real action eventually happens, "overlay or
      // not" (see COLLECTION_TOUR_STEPS' comment in steps.ts). complete() would reset
      // currentIndex to -1, which advanceIfCurrentStep can never match again — permanently
      // stranding the tour the moment a user skips instead of pressing "+".
      set({ active: false })
    } else {
      get().complete()
    }
  },

  complete: () => {
    const { tourId } = get()
    // currentIndex: -1 rather than leaving it at its last value — TOURS[tourId][-1] is always
    // undefined, so a later advanceIfCurrentStep call can never accidentally re-match a stale
    // index (e.g. the user skipped mid-tour, currentIndex happened to sit on some step id, and
    // an unrelated later press of that same element would otherwise silently reopen the tour).
    set({ active: false, currentIndex: -1 })
    persistTourComplete(tourId).catch(console.error)
  },

  advanceIfCurrentStep: (id) => {
    const { tourId, currentIndex } = get()
    if (TOURS[tourId][currentIndex]?.id !== id) return
    // Re-activate first: if this was the tour's last step, the next() call below completes it
    // (setting active back to false) — correct either way, this just ensures a dropped/dismissed
    // overlay reappears for every step short of the last one.
    set({ active: true })
    get().next()
  },
}))

async function persistTourComplete(tourId: TourId): Promise<void> {
  const user = useUserStore.getState().user
  if (!user) return
  const patch =
    tourId === 'collection'
      ? { collection_tour: true }
      : tourId === 'add-card'
        ? { add_card_tour: true }
        : { tour: true }
  const next = await patchOnboardingState(user.id, patch)
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
          useOnboardingStore.getState().start('main')
        }
      }, 1200)
    }
  }, [status, profileSetupComplete, tourComplete])

  return null
}

/**
 * Mount from the Collections screen itself (not app-wide) — fires the Collections-tab guided
 * tour the first time that screen is visited, once profile setup + the main tour are out of the
 * way. Re-attempts (without re-persisting) each time its deps change until it actually starts,
 * so opening Collections while the main tour is still active doesn't permanently skip it.
 */
export function useCollectionTourTrigger() {
  const status = useUserStore((s) => s.status)
  const profileSetupComplete = useUserStore((s) => s.profileSetupComplete)
  const collectionTourComplete = useUserStore((s) => s.onboardingState?.collection_tour === true)
  const mainTourActive = useOnboardingStore((s) => s.active && s.tourId === 'main')

  useEffect(() => {
    if (status !== 'authenticated') return
    if (!profileSetupComplete) return
    if (collectionTourComplete) return
    if (mainTourActive) return

    const t = setTimeout(() => {
      const store = useOnboardingStore.getState()
      // resumeOrStart, not start — the "+" button (and the rest of this screen) becoming
      // visible again should pick up wherever the tour left off, not restart from step 0 over
      // existing in-memory progress just because the user re-visited this screen.
      if (!store.active) store.resumeOrStart('collection')
    }, 600)
    return () => clearTimeout(t)
  }, [status, profileSetupComplete, collectionTourComplete, mainTourActive])
}

/**
 * Fired from the Add-to-collection search screen's first result row itself (see
 * AddCardToCollectionAccessories in features/collection/pages/add-card.tsx), not from the
 * screen's own mount — this screen has no default listing (useCardSearch requires 2+ typed
 * characters), so there's no target to show the tour against until a first result actually
 * renders. Pass `isFirstResult` true only from that row; every other row's call is a no-op via
 * the guard below, so it's safe to call this from every rendered row's effect deps.
 */
export function useAddCardTourTrigger(isFirstResult: boolean) {
  const status = useUserStore((s) => s.status)
  const profileSetupComplete = useUserStore((s) => s.profileSetupComplete)
  const addCardTourComplete = useUserStore((s) => s.onboardingState?.add_card_tour === true)
  const otherTourActive = useOnboardingStore((s) => s.active && s.tourId !== 'add-card')

  useEffect(() => {
    if (!isFirstResult) return
    if (status !== 'authenticated') return
    if (!profileSetupComplete) return
    if (addCardTourComplete) return
    if (otherTourActive) return

    const store = useOnboardingStore.getState()
    if (!store.active) store.resumeOrStart('add-card')
  }, [isFirstResult, status, profileSetupComplete, addCardTourComplete, otherTourActive])
}
