// Imported directly from their own modules, not the '@/features/onboarding' barrel — that barrel
// also re-exports OnboardingOverlay/ProfileSetupWizard, which pull in @shopify/react-native-skia
// (native ESM Jest can't parse) purely from module evaluation order, even though this test never
// touches either.
import { getTourProgress, useOnboardingStore } from '@/features/onboarding/OnboardingProvider'
import { TOURS } from '@/features/onboarding/steps'
import { OnboardingStepId, TourId } from '@/features/onboarding/types'
import { patchOnboardingState } from '@/lib/store/onboardingState'
import { useUserStore } from '@/lib/store/useUserStore'

jest.mock('@/lib/store/onboardingState', () => ({
  patchOnboardingState: jest.fn(),
}))

const mockPatch = patchOnboardingState as jest.Mock

const collectionSteps = TOURS.collection
const pinnedHeaderIndex = collectionSteps.findIndex((s) => s.id === 'collection-pinned-header')
const newButtonIndex = collectionSteps.findIndex((s) => s.id === 'collection-new-button')

const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

/** Simulates OnboardingTarget mounting for each id. */
const mountTargets = (...ids: OnboardingStepId[]) =>
  ids.forEach((id) => useOnboardingStore.getState().registerTarget(id, { current: null }))
const mountTour = (tourId: TourId) => mountTargets(...TOURS[tourId].map((s) => s.id))

describe('useOnboardingStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPatch.mockResolvedValue({})
    useOnboardingStore.setState({
      active: false,
      tourId: 'main',
      currentIndex: 0,
      measurements: {},
      _registry: new Map(),
      waitingForTarget: false,
      skippedSteps: [],
    })
    useUserStore.setState({ user: null } as any)
  })

  describe('start', () => {
    it('activates the given tour at step 0, clearing any stale measurements', () => {
      useOnboardingStore.setState({
        measurements: { 'settings-icon': { x: 0, y: 0, width: 1, height: 1 } },
      })

      mountTour('collection')
      useOnboardingStore.getState().start('collection')

      expect(useOnboardingStore.getState()).toMatchObject({
        active: true,
        tourId: 'collection',
        currentIndex: 0,
        measurements: {},
      })
    })

    it('defaults to the main tour when called with no argument', () => {
      mountTour('main')
      useOnboardingStore.getState().start()
      expect(useOnboardingStore.getState().tourId).toBe('main')
    })
  })

  describe('resumeOrStart', () => {
    it('reopens in place when the same tour is already partway through', () => {
      mountTour('collection')
      useOnboardingStore.setState({ tourId: 'collection', currentIndex: 2, active: false })

      useOnboardingStore.getState().resumeOrStart('collection')

      expect(useOnboardingStore.getState()).toMatchObject({ active: true, currentIndex: 2 })
    })

    it('starts fresh at step 0 for a tour never engaged this session', () => {
      mountTour('add-card')
      useOnboardingStore.setState({ tourId: 'main', currentIndex: 0, active: false })

      useOnboardingStore.getState().resumeOrStart('add-card')

      expect(useOnboardingStore.getState()).toMatchObject({
        tourId: 'add-card',
        currentIndex: 0,
        active: true,
      })
    })

    it('starts fresh after a tour has already fully completed (currentIndex -1)', () => {
      mountTour('collection')
      useOnboardingStore.setState({ tourId: 'collection', currentIndex: -1, active: false })

      useOnboardingStore.getState().resumeOrStart('collection')

      expect(useOnboardingStore.getState()).toMatchObject({ currentIndex: 0, active: true })
    })
  })

  describe('next / back', () => {
    it('advances to the next step within a tour', () => {
      mountTour('collection')
      useOnboardingStore.setState({ tourId: 'collection', currentIndex: 0, active: true })

      useOnboardingStore.getState().next()

      expect(useOnboardingStore.getState().currentIndex).toBe(1)
    })

    it('completes the tour when next() is called on its last step', () => {
      useUserStore.setState({ user: { id: 'user-1' } } as any)
      const lastIndex = collectionSteps.length - 1
      useOnboardingStore.setState({ tourId: 'collection', currentIndex: lastIndex, active: true })

      useOnboardingStore.getState().next()

      expect(useOnboardingStore.getState()).toMatchObject({ active: false, currentIndex: -1 })
    })

    it('does not move back past the first step', () => {
      useOnboardingStore.setState({ tourId: 'collection', currentIndex: 0, active: true })

      useOnboardingStore.getState().back()

      expect(useOnboardingStore.getState().currentIndex).toBe(0)
    })

    it('moves back one step when not on the first step', () => {
      mountTour('collection')
      useOnboardingStore.setState({ tourId: 'collection', currentIndex: 2, active: true })

      useOnboardingStore.getState().back()

      expect(useOnboardingStore.getState().currentIndex).toBe(1)
    })
  })

  describe('skip', () => {
    it('fully completes a normal (non-advanceByAction) step', () => {
      useOnboardingStore.setState({
        tourId: 'collection',
        currentIndex: pinnedHeaderIndex,
        active: true,
      })

      useOnboardingStore.getState().skip()

      expect(useOnboardingStore.getState()).toMatchObject({ active: false, currentIndex: -1 })
    })

    it('only hides the overlay for an advanceByAction step, preserving progress', () => {
      useOnboardingStore.setState({
        tourId: 'collection',
        currentIndex: newButtonIndex,
        active: true,
      })

      useOnboardingStore.getState().skip()

      expect(useOnboardingStore.getState()).toMatchObject({
        active: false,
        currentIndex: newButtonIndex,
      })
    })
  })

  describe('advanceIfCurrentStep', () => {
    it('is a no-op when the id does not match the current step', () => {
      useOnboardingStore.setState({ tourId: 'collection', currentIndex: 0, active: false })

      useOnboardingStore.getState().advanceIfCurrentStep('collection-new-button')

      expect(useOnboardingStore.getState()).toMatchObject({ active: false, currentIndex: 0 })
    })

    it('re-activates and advances when the id matches the current step, even with the overlay hidden', () => {
      mountTour('collection')
      useOnboardingStore.setState({
        tourId: 'collection',
        currentIndex: newButtonIndex,
        active: false,
      })

      useOnboardingStore.getState().advanceIfCurrentStep('collection-new-button')

      expect(useOnboardingStore.getState()).toMatchObject({
        active: true,
        currentIndex: newButtonIndex + 1,
      })
    })
  })

  describe('complete / persistTourComplete', () => {
    it('does not persist anything when there is no signed-in user', async () => {
      useUserStore.setState({ user: null } as any)
      useOnboardingStore.setState({ tourId: 'main', currentIndex: 0, active: true })

      useOnboardingStore.getState().complete()
      await flushPromises()

      expect(mockPatch).not.toHaveBeenCalled()
    })

    it.each([
      ['main', { tour: true }],
      ['collection', { collection_tour: true }],
      ['add-card', { add_card_tour: true }],
      ['offers', { offer_tour: true }],
    ] as const)(
      'persists the right flag for the %s tour',
      async (
        tourId: 'main' | 'collection' | 'add-card' | 'offers',
        expectedPatch: Record<string, boolean>
      ) => {
        useUserStore.setState({ user: { id: 'user-1' } } as any)
        useOnboardingStore.setState({ tourId, currentIndex: 0, active: true })

        useOnboardingStore.getState().complete()
        await flushPromises()

        expect(mockPatch).toHaveBeenCalledWith('user-1', expectedPatch)
      }
    )
  })

  describe('target existence checks', () => {
    const mainIds = TOURS.main.map((s) => s.id)

    it('skips a step whose element is not on screen instead of dimming with only Skip', () => {
      // collection-graphs has no element on the home screen.
      mountTargets(...mainIds.filter((id) => id !== 'collection-graphs'))
      useUserStore.setState({ user: { id: 'user-1' } } as any)
      const tabList = mainIds.indexOf('tab-list')
      useOnboardingStore.setState({ tourId: 'main', currentIndex: tabList, active: true })

      useOnboardingStore.getState().next()

      // collection-graphs was the last step, so the tour completes.
      expect(useOnboardingStore.getState()).toMatchObject({ active: false, currentIndex: -1 })
    })

    it('skips a missing step in the middle and lands on the next one that exists', () => {
      mountTargets(...mainIds.filter((id) => id !== 'search-bar'))
      useOnboardingStore.getState().start('main')

      useOnboardingStore.getState().next()

      expect(useOnboardingStore.getState()).toMatchObject({
        active: true,
        currentIndex: mainIds.indexOf('collection-breakdown'),
        skippedSteps: ['search-bar'],
      })
    })

    it('start() begins at the first step that exists', () => {
      mountTargets('search-bar', 'tab-list')
      useOnboardingStore.getState().start('main')

      expect(useOnboardingStore.getState()).toMatchObject({
        active: true,
        currentIndex: mainIds.indexOf('search-bar'),
      })
    })

    it('start() is a no-op (and persists nothing) when no step has an element', async () => {
      useUserStore.setState({ user: { id: 'user-1' } } as any)
      useOnboardingStore.getState().start('main')
      await flushPromises()

      expect(useOnboardingStore.getState().active).toBe(false)
      expect(mockPatch).not.toHaveBeenCalled()
    })

    it('back() skips earlier steps whose element is gone', () => {
      mountTargets('settings-icon', 'collection-breakdown')
      useOnboardingStore.setState({
        tourId: 'main',
        currentIndex: mainIds.indexOf('collection-breakdown'),
        active: true,
      })

      useOnboardingStore.getState().back()

      expect(useOnboardingStore.getState().currentIndex).toBe(mainIds.indexOf('settings-icon'))
    })

    it('waits (overlay hidden) for an awaitsNavigation step, then shows it when it mounts', () => {
      mountTargets('collection-pinned-header', 'collection-new-button')
      useOnboardingStore.setState({
        tourId: 'collection',
        currentIndex: newButtonIndex,
        active: false,
      })

      // Tapping "+" — the new-collection screen hasn't mounted yet.
      useOnboardingStore.getState().advanceIfCurrentStep('collection-new-button')
      expect(useOnboardingStore.getState()).toMatchObject({
        active: false,
        waitingForTarget: true,
        currentIndex: newButtonIndex + 1,
      })

      mountTargets('collection-details-input')
      expect(useOnboardingStore.getState()).toMatchObject({
        active: true,
        waitingForTarget: false,
        currentIndex: newButtonIndex + 1,
      })
    })

    it('resumeOrStart() falls back to the step that leads to an abandoned screen', () => {
      mountTargets('collection-pinned-header', 'collection-new-button')
      const detailsInput = collectionSteps.findIndex((s) => s.id === 'collection-details-input')
      useOnboardingStore.setState({
        tourId: 'collection',
        currentIndex: detailsInput,
        active: false,
        waitingForTarget: true,
      })

      useOnboardingStore.getState().resumeOrStart('collection')

      expect(useOnboardingStore.getState()).toMatchObject({
        active: true,
        currentIndex: newButtonIndex,
      })
    })

    it('skipUnmeasurableStep() moves past a mounted target that never measured', () => {
      mountTour('main')
      useOnboardingStore.getState().start('main')

      useOnboardingStore.getState().skipUnmeasurableStep('settings-icon')

      expect(useOnboardingStore.getState()).toMatchObject({
        currentIndex: 1,
        skippedSteps: ['settings-icon'],
      })
    })

    it('skipUnmeasurableStep() is a no-op once the step has measured', () => {
      mountTour('main')
      useOnboardingStore.getState().start('main')
      useOnboardingStore
        .getState()
        .setMeasurement('settings-icon', { x: 0, y: 0, width: 10, height: 10 })

      useOnboardingStore.getState().skipUnmeasurableStep('settings-icon')

      expect(useOnboardingStore.getState().currentIndex).toBe(0)
    })

    it('getTourProgress() counts only steps that will be shown', () => {
      mountTargets(...mainIds.filter((id) => id !== 'collection-graphs'))
      const { _registry } = useOnboardingStore.getState()
      const tabList = mainIds.indexOf('tab-list')

      expect(getTourProgress(TOURS.main, _registry, tabList, [])).toEqual({
        index: tabList,
        total: mainIds.length - 1,
        canGoBack: true,
      })
    })
  })
})
