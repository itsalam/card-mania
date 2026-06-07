import { SystemAdapter, SystemState } from './system-adapter'

function buildSnapshot(): SystemState {
  return {
    systemColorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }
}

export const webSystemAdapter: SystemAdapter = {
  async getSnapshot() {
    return buildSnapshot()
  },
  subscribe(cb) {
    const colorQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    colorQuery.addEventListener('change', cb)
    motionQuery.addEventListener('change', cb)
    return () => {
      colorQuery.removeEventListener('change', cb)
      motionQuery.removeEventListener('change', cb)
    }
  },
}
