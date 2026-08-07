import { SavedCollectionRow } from '@/lib/store/functions/types'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_KEY_PREFIX = 'saved-collections'

type CachedSavedCollections = {
  data: SavedCollectionRow[]
  ts: number
}

export async function readCachedSavedCollections(
  userId: string
): Promise<CachedSavedCollections | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}-${userId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedSavedCollections
    if (!Array.isArray(parsed?.data) || typeof parsed?.ts !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export async function writeCachedSavedCollections(userId: string, data: SavedCollectionRow[]) {
  try {
    await AsyncStorage.setItem(
      `${CACHE_KEY_PREFIX}-${userId}`,
      JSON.stringify({ data, ts: Date.now() } satisfies CachedSavedCollections)
    )
  } catch {
    // best-effort — a failed on-device cache write shouldn't break the query
  }
}
