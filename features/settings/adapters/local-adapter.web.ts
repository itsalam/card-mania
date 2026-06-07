import { LocalAdapter } from './local-adapter'

const prefix = 'settings:'

export const localStorageLocalAdapter: LocalAdapter = {
  async getMany(keys) {
    const out: Record<string, unknown> = {}
    for (const key of keys) {
      const raw = localStorage.getItem(prefix + key)
      if (raw == null) continue
      try {
        out[key] = JSON.parse(raw)
      } catch {
        // ignore corrupt value
      }
    }
    return out
  },
  async set(key, value) {
    localStorage.setItem(prefix + key, JSON.stringify(value))
  },
  async remove(key) {
    localStorage.removeItem(prefix + key)
  },
}
