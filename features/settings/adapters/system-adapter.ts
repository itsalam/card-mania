// src/settings/adapters/system.ts
import { AccessibilityInfo, Appearance } from 'react-native'

export type SystemState = Record<string, unknown>

export type SystemAdapter = {
  /** called once to seed system settings */
  getSnapshot(): Promise<SystemState>
  /** subscribe to changes; call callback when snapshot changed */
  subscribe(cb: () => void): () => void
}

let cached: SystemState = {}

async function buildSnapshot(): Promise<SystemState> {
  const colorScheme = Appearance.getColorScheme() ?? 'light'
  const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled()

  return {
    systemColorScheme: colorScheme, // "light" | "dark"
    reduceMotion,
  }
}

export const reactNativeSystemAdapter: SystemAdapter = {
  async getSnapshot() {
    cached = await buildSnapshot()
    return cached
  },
  subscribe(cb) {
    const sub1 = Appearance.addChangeListener(async () => {
      cached = await buildSnapshot()
      cb()
    })

    // AccessibilityInfo doesn't have a single unified subscription in all RN versions;
    // in modern RN you can use addEventListener("reduceMotionChanged", ...)
    // We'll do best-effort:
    let remove2: undefined | (() => void)

    const maybeSub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', async () => {
      cached = await buildSnapshot()
      cb()
    })
    remove2 = typeof maybeSub?.remove === 'function' ? () => maybeSub.remove() : undefined

    return () => {
      sub1.remove()
      remove2?.()
    }
  },
}
