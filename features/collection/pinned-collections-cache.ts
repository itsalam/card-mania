import { PinnedCollectionItemRow } from '@/lib/store/functions/types'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_KEY_PREFIX = 'pinned-collections'

type CachedPinnedCollections = {
  data: PinnedCollectionItemRow[]
  ts: number
}

export async function readCachedPinnedCollections(
  userId: string
): Promise<CachedPinnedCollections | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}-${userId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedPinnedCollections
    if (!Array.isArray(parsed?.data) || typeof parsed?.ts !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export async function writeCachedPinnedCollections(
  userId: string,
  data: PinnedCollectionItemRow[]
) {
  try {
    await AsyncStorage.setItem(
      `${CACHE_KEY_PREFIX}-${userId}`,
      JSON.stringify({ data, ts: Date.now() } satisfies CachedPinnedCollections)
    )
  } catch {
    // best-effort — a failed on-device cache write shouldn't break the query
  }
}
