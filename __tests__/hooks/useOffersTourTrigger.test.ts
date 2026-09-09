import { renderHook, waitFor } from '@testing-library/react-native'

// Imported directly from OnboardingProvider.tsx, not the '@/features/onboarding' barrel — that
// barrel also re-exports OnboardingOverlay/ProfileSetupWizard, which pull in
// @shopify/react-native-skia (native ESM Jest can't parse) purely from module evaluation order.
import {
  OnboardingProvider,
  useOffersTourTrigger,
  useOnboardingStore,
} from '@/features/onboarding/OnboardingProvider'
import { getSupabase } from '@/lib/store/client'
import { useUserStore } from '@/lib/store/useUserStore'
import { createWrapper } from '../test-utils'

// The OnboardingProvider watcher tests below call complete(), which fires a real (fire-and-forget,
// .catch()-guarded) persistTourComplete() call — mocked here purely to avoid it falling through to
// the bare getSupabase() mock's un-chained .from() and erroring in the background.
jest.mock('@/lib/store/onboardingState', () => ({
  patchOnboardingState: jest.fn().mockResolvedValue({}),
}))

const mockClient = getSupabase() as any

function mockActivationStatus(hasOffer: boolean) {
  const single = jest.fn().mockResolvedValue({
    data: {
      has_storefront: false,
      has_collection_item: false,
      has_offer: hasOffer,
      activated: hasOffer,
    },
    error: null,
  })
  mockClient.rpc.mockReturnValue({ single })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('useOffersTourTrigger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useOnboardingStore.setState({
      active: false,
      tourId: 'main',
      currentIndex: 0,
      measurements: {},
    })
    useUserStore.setState({
      user: { id: 'user-1' } as any,
      status: 'authenticated',
      profileSetupComplete: true,
      onboardingState: {},
    })
  })

  it('starts the offers tour once has_offer resolves false', async () => {
    mockActivationStatus(false)
    const { wrapper } = createWrapper()

    await renderHook(() => useOffersTourTrigger(), { wrapper })

    await waitFor(() => expect(useOnboardingStore.getState().active).toBe(true), {
      timeout: 2000,
    })
    expect(useOnboardingStore.getState().tourId).toBe('offers')
  })

  it('does not start when has_offer is already true', async () => {
    mockActivationStatus(true)
    const { wrapper } = createWrapper()

    await renderHook(() => useOffersTourTrigger(), { wrapper })
    await waitFor(() => expect(mockClient.rpc).toHaveBeenCalled())
    await sleep(700)

    expect(useOnboardingStore.getState().active).toBe(false)
  })

  it('does not start when offer_tour is already marked complete', async () => {
    mockActivationStatus(false)
    useUserStore.setState({ onboardingState: { offer_tour: true } })
    const { wrapper } = createWrapper()

    await renderHook(() => useOffersTourTrigger(), { wrapper })
    await sleep(700)

    expect(useOnboardingStore.getState().active).toBe(false)
  })

  it('does not start while a different tour is already active', async () => {
    mockActivationStatus(false)
    useOnboardingStore.setState({ active: true, tourId: 'collection' })
    const { wrapper } = createWrapper()

    await renderHook(() => useOffersTourTrigger(), { wrapper })
    await sleep(700)

    expect(useOnboardingStore.getState().tourId).toBe('collection')
  })
})

describe('OnboardingProvider — offers tour auto-complete watcher', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useOnboardingStore.setState({
      active: false,
      tourId: 'main',
      currentIndex: 0,
      measurements: {},
    })
    useUserStore.setState({
      user: { id: 'user-1' } as any,
      status: 'authenticated',
      profileSetupComplete: true,
      // tour: true disables OnboardingProvider's own main-tour auto-start timer, which would
      // otherwise race with (and confuse assertions about) the offers-tour watcher under test.
      onboardingState: { tour: true },
    })
  })

  it('completes an active offers tour the instant has_offer flips true', async () => {
    mockActivationStatus(true)
    useOnboardingStore.setState({ active: true, tourId: 'offers', currentIndex: 0 })
    const { wrapper } = createWrapper()

    await renderHook(() => OnboardingProvider(), { wrapper })

    await waitFor(() => expect(useOnboardingStore.getState().active).toBe(false))
    expect(useOnboardingStore.getState().currentIndex).toBe(-1)
  })

  it('does not touch a different active tour even when has_offer is true', async () => {
    mockActivationStatus(true)
    useOnboardingStore.setState({ active: true, tourId: 'collection', currentIndex: 1 })
    const { wrapper } = createWrapper()

    await renderHook(() => OnboardingProvider(), { wrapper })
    await sleep(700)

    expect(useOnboardingStore.getState()).toMatchObject({
      active: true,
      tourId: 'collection',
      currentIndex: 1,
    })
  })

  it('does not complete the offers tour while has_offer is still false', async () => {
    mockActivationStatus(false)
    useOnboardingStore.setState({ active: true, tourId: 'offers', currentIndex: 0 })
    const { wrapper } = createWrapper()

    await renderHook(() => OnboardingProvider(), { wrapper })
    await sleep(700)

    expect(useOnboardingStore.getState()).toMatchObject({ active: true, tourId: 'offers' })
  })
})
