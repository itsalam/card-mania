import { imperativeDevToast } from '@/components/Toast'
import { useRef } from 'react'

/**
 * Debug-only double-tap trigger. Returns an `onPress` handler for a `Pressable`/`TouchableOpacity`
 * that fires `onTrigger` when tapped twice within `thresholdMs` — a no-op in production builds.
 * Firing is confirmed via both a console log and a visible dev toast, so it's never silently
 * unclear whether the tap registered.
 *
 * Usage: `<Pressable onPress={useDebugDoubleTap('Collection tour', () => start('collection'))}>`
 */
export function useDebugDoubleTap(
  label: string,
  onTrigger: () => void,
  { thresholdMs = 400 }: { thresholdMs?: number } = {}
): () => void {
  const lastTapRef = useRef(0)

  return () => {
    // Logged unconditionally, before the __DEV__ gate — if this line never appears, the press
    // itself isn't reaching this handler (wrong element, something above it swallowing the
    // touch, etc.), not a double-tap-timing issue.
    console.log(`[debug-double-tap] press received: ${label} (__DEV__=${String(__DEV__)})`)
    if (!__DEV__) return

    const now = Date.now()
    if (now - lastTapRef.current < thresholdMs) {
      lastTapRef.current = 0
      console.log(`[debug-double-tap] fired: ${label}`)
      imperativeDevToast({
        title: 'Debug trigger',
        message: label,
        preset: 'success',
        autoDismiss: 2000,
      })
      onTrigger()
    } else {
      lastTapRef.current = now
      console.log(`[debug-double-tap] first tap registered, waiting for second: ${label}`)
    }
  }
}
