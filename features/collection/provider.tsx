// store.ts
import { createContext, ReactNode, useContext, useRef } from 'react'
import { createStore, StoreApi, useStore } from 'zustand'
import { PreferenceState, useCollectionUiPreferences } from './hooks'

export const defaultPages = ['default', 'vault', 'wishlist', 'selling'] as const
export type PageTypes = (typeof defaultPages)[number]

type CollectionsState = {
  preferenceState: PreferenceState
  currentPage: string
  exploreLayout: string
  setCurrentPage: (page: string) => void
  setExploreLayout: (layout: string) => void
}

export const createCollectionPageStore = (preferenceState: PreferenceState) =>
  createStore<CollectionsState>((set) => ({
    preferenceState,
    currentPage: defaultPages[0],
    exploreLayout: 'grid',
    setExploreLayout: (layout) => set({ exploreLayout: layout }),
    setCurrentPage: (page) => set({ currentPage: page }),
  }))

export const CollectionPageContext = createContext<StoreApi<CollectionsState> | null>(null)

export const CollectionsViewProvider = (props: { children: ReactNode }) => {
  const preferencesState = useCollectionUiPreferences()

  const storeRef = useRef<StoreApi<CollectionsState> | null>(null)
  if (!storeRef.current) storeRef.current = createCollectionPageStore(preferencesState)

  return <CollectionPageContext.Provider value={storeRef.current} {...props} />
}

export const useCollectionsPageStore = () => {
  const store = useContext(CollectionPageContext)
  if (!store)
    throw new Error('useCollectionsPageStore must be used within CreateNewCollectionsProvider')
  return useStore(store)
}
