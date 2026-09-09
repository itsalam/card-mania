// Imported directly from their own modules, not the '@/features/onboarding' barrel — that barrel
// also re-exports OnboardingOverlay/ProfileSetupWizard, which pull in @shopify/react-native-skia
// (native ESM Jest can't parse) purely from module evaluation order, even though this test never
// touches either.
import { useOnboardingStore } from '@/features/onboarding/OnboardingProvider'
import { TOURS } from '@/features/onboarding/steps'
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

describe('useOnboardingStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPatch.mockResolvedValue({})
    useOnboardingStore.setState({
      active: false,
      tourId: 'main',
      currentIndex: 0,
      measurements: {},
    })
    useUserStore.setState({ user: null } as any)
  })

  describe('start', () => {
    it('activates the given tour at step 0, clearing any stale measurements', () => {
      useOnboardingStore.setState({
        measurements: { 'settings-icon': { x: 0, y: 0, width: 1, height: 1 } },
      })

      useOnboardingStore.getState().start('collection')

      expect(useOnboardingStore.getState()).toMatchObject({
        active: true,
        tourId: 'collection',
        currentIndex: 0,
        measurements: {},
      })
    })

    it('defaults to the main tour when called with no argument', () => {
      useOnboardingStore.getState().start()
      expect(useOnboardingStore.getState().tourId).toBe('main')
    })
  })

  describe('resumeOrStart', () => {
    it('reopens in place when the same tour is already partway through', () => {
      useOnboardingStore.setState({ tourId: 'collection', currentIndex: 2, active: false })

      useOnboardingStore.getState().resumeOrStart('collection')

      expect(useOnboardingStore.getState()).toMatchObject({ active: true, currentIndex: 2 })
    })

    it('starts fresh at step 0 for a tour never engaged this session', () => {
      useOnboardingStore.setState({ tourId: 'main', currentIndex: 0, active: false })

      useOnboardingStore.getState().resumeOrStart('add-card')

      expect(useOnboardingStore.getState()).toMatchObject({
        tourId: 'add-card',
        currentIndex: 0,
        active: true,
      })
    })

    it('starts fresh after a tour has already fully completed (currentIndex -1)', () => {
      useOnboardingStore.setState({ tourId: 'collection', currentIndex: -1, active: false })

      useOnboardingStore.getState().resumeOrStart('collection')

      expect(useOnboardingStore.getState()).toMatchObject({ currentIndex: 0, active: true })
    })
  })

  describe('next / back', () => {
    it('advances to the next step within a tour', () => {
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
})
