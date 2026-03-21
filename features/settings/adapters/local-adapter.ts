import AsyncStorage from '@react-native-async-storage/async-storage'

export type LocalAdapter = {
  getMany(keys: string[]): Promise<Record<string, unknown>>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
}

const prefix = 'settings:'

export const asyncStorageLocalAdapter: LocalAdapter = {
  async getMany(keys) {
    const entries = await AsyncStorage.multiGet(keys.map((k) => prefix + k))
    const out: Record<string, unknown> = {}
    for (const [storageKey, raw] of entries) {
      const key = storageKey.replace(prefix, '')
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
    await AsyncStorage.setItem(prefix + key, JSON.stringify(value))
  },
  async remove(key) {
    await AsyncStorage.removeItem(prefix + key)
  },
}
