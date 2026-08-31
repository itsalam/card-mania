import { renderHook } from '@testing-library/react-native'

import { imperativeDevToast } from '@/components/Toast'
import { useDebugDoubleTap } from '@/lib/hooks/useDebugDoubleTap'

const mockToast = imperativeDevToast as jest.Mock

// A non-zero baseline — lastTapRef itself starts at 0, so mocking Date.now() to literally 0 for
// the very first tap would make `now - lastTapRef.current` also 0, falsely looking like it's
// already within the threshold of a "previous" tap that never happened.
const T0 = 1_000_000

describe('useDebugDoubleTap', () => {
  const originalDev = global.__DEV__
  let nowSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    global.__DEV__ = true
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(T0)
  })

  afterEach(() => {
    global.__DEV__ = originalDev
    nowSpy.mockRestore()
  })

  it('does not fire on a single tap', async () => {
    const onTrigger = jest.fn()
    const { result } = await renderHook(() => useDebugDoubleTap('test', onTrigger))

    result.current()

    expect(onTrigger).not.toHaveBeenCalled()
    expect(mockToast).not.toHaveBeenCalled()
  })

  it('fires on a second tap within the threshold', async () => {
    const onTrigger = jest.fn()
    const { result } = await renderHook(() => useDebugDoubleTap('test', onTrigger))

    result.current()
    nowSpy.mockReturnValue(T0 + 200)
    result.current()

    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledTimes(1)
  })

  it('does not fire when the second tap arrives after the threshold, and restarts the window', async () => {
    const onTrigger = jest.fn()
    const { result } = await renderHook(() => useDebugDoubleTap('test', onTrigger))

    result.current()
    nowSpy.mockReturnValue(T0 + 500) // past the default 400ms threshold
    result.current()

    expect(onTrigger).not.toHaveBeenCalled()

    // The late second tap above becomes the new "first tap" of a fresh window.
    nowSpy.mockReturnValue(T0 + 650)
    result.current()

    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('resets after firing, so a third tap does not immediately fire again', async () => {
    const onTrigger = jest.fn()
    const { result } = await renderHook(() => useDebugDoubleTap('test', onTrigger))

    result.current()
    nowSpy.mockReturnValue(T0 + 200)
    result.current()
    expect(onTrigger).toHaveBeenCalledTimes(1)

    nowSpy.mockReturnValue(T0 + 250)
    result.current()
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('respects a custom thresholdMs', async () => {
    const onTrigger = jest.fn()
    const { result } = await renderHook(() =>
      useDebugDoubleTap('test', onTrigger, { thresholdMs: 1000 })
    )

    result.current()
    nowSpy.mockReturnValue(T0 + 900)
    result.current()

    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('never fires when __DEV__ is false, even on a fast double tap', async () => {
    global.__DEV__ = false
    const onTrigger = jest.fn()
    const { result } = await renderHook(() => useDebugDoubleTap('test', onTrigger))

    result.current()
    nowSpy.mockReturnValue(T0 + 50)
    result.current()

    expect(onTrigger).not.toHaveBeenCalled()
    expect(mockToast).not.toHaveBeenCalled()
  })
})
