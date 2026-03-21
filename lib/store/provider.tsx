import { createContext, useContext, useMemo } from 'react'
import { createJSONStorage } from 'zustand/middleware'
import { useShallow } from 'zustand/shallow'
import { CardStorePersist, CardStoreState, makeCardStore } from './states/cards'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useStore } from 'zustand'

function createStorage<T>() {
  // Cross-platform storage: RN = AsyncStorage, Web = localStorage
  try {
    return createJSONStorage<T>(() => AsyncStorage)
  } catch {
    return createJSONStorage<T>(() => localStorage)
  }
}

const StoreContexts = createContext<{
  cardStore: ReturnType<typeof makeCardStore>
} | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Create the store hook ONCE and keep it stable
  const cardStore = useMemo(() => makeCardStore(() => createStorage<CardStorePersist>()), [])
  return <StoreContexts.Provider value={{ cardStore }}>{children}</StoreContexts.Provider>
}

export function useStores() {
  const context = useContext(StoreContexts)
  if (!context) {
    throw new Error('useStores must be used within a ContextsProvider')
  }
  return context
}

export function useCardStore<T>(selector: (s: CardStoreState) => T): T {
  const ctx = useContext(StoreContexts)
  if (!ctx) throw new Error('StoreProvider is missing')
  return useStore(ctx.cardStore, useShallow(selector))
}
