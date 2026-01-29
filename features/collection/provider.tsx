// store.ts
import { CollectionLike } from '@/client/collections/types'
import { createContext, ReactNode, useContext, useEffect, useRef } from 'react'
import { createStore, StoreApi, useStore } from 'zustand'
import { PreferenceState, useCollectionUiPreferences } from './hooks'

export const defaultPages = ['default', 'vault', 'wishlist', 'selling'] as const
export type DefaultPageTypes = (typeof defaultPages)[number]

export const getCollectionIdArgs = (currentPage: string) =>
  defaultPages.includes(currentPage as (typeof defaultPages)[number])
    ? { collectionType: currentPage as DefaultPageTypes }
    : { collectionId: currentPage }

type CollectionsState = {
  preferenceState: PreferenceState
  currentPage: string
  exploreLayout: string
  expanded?: boolean
  setCurrentPage: (page: string) => void
  setExploreLayout: (layout: string) => void
  setIsExpanded: (expanded: boolean) => void
  searchQuery?: string
  setSearchQuery: (searchQuery?: string) => void
  resetSearchQuery: () => void
  showEditView: boolean
  setShowEditView: (showEditView: boolean) => void
  newCollectionInfo?: CollectionLike
  setNewCollectionInfo: (ci: CollectionLike) => void
}

export const createCollectionPageStore = (preferenceState: PreferenceState) =>
  createStore<CollectionsState>((set) => ({
    preferenceState,
    currentPage: defaultPages[0],
    exploreLayout: 'grid',
    setExploreLayout: (layout) => set({ exploreLayout: layout }),
    setCurrentPage: (page) => set({ currentPage: page, showEditView: page === 'new' }),
    showEditView: false,
    setShowEditView: (showEditView) => set({ showEditView }),
    expanded: false,
    setIsExpanded: (expanded) => set({ expanded }),
    searchQuery: undefined,
    newCollectionInfo: undefined,
    setNewCollectionInfo: (ci) => set({ newCollectionInfo: ci }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    resetSearchQuery: () => set({ searchQuery: undefined }),
  }))

export const CollectionPageContext = createContext<StoreApi<CollectionsState> | null>(null)

export const CollectionsViewProvider = (props: { children: ReactNode }) => {
  const preferencesState = useCollectionUiPreferences()

  const storeRef = useRef<StoreApi<CollectionsState> | null>(null)
  if (!storeRef.current) storeRef.current = createCollectionPageStore(preferencesState)

  // Keep zustand store in sync when preferences change
  useEffect(() => {
    storeRef.current?.setState({ preferenceState: preferencesState })
  }, [preferencesState])

  return <CollectionPageContext.Provider value={storeRef.current} {...props} />
}

export const useCollectionsPageStore = () => {
  const store = useContext(CollectionPageContext)
  if (!store)
    throw new Error('useCollectionsPageStore must be used within CreateNewCollectionsProvider')
  return useStore(store)
}
