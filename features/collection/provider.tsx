// store.ts
import { CollectionLike } from '@/client/collections/types'
import { PinnedCollectionItemRow, SavedCollectionRow } from '@/lib/store/functions/types'
import { createContext, ReactNode, useContext, useEffect, useRef } from 'react'
import { createStore, StoreApi, useStore } from 'zustand'
import {
  PreferenceState,
  useCollectionUiPreferences,
  usePinnedCollections,
  useRemovePinnedCollection,
  useRemoveSavedCollection,
  useSavedCollections,
  useTouchPinnedCollection,
  useTouchSavedCollection,
} from './hooks'

export const defaultPages = ['default', 'vault', 'wishlist', 'selling'] as const
export type DefaultPageTypes = (typeof defaultPages)[number]

export const getCollectionIdArgs = (currentPage: string) =>
  defaultPages.includes(currentPage as (typeof defaultPages)[number])
    ? { collectionType: currentPage as DefaultPageTypes }
    : { collectionId: currentPage }

export type SavedCollectionsState = {
  data: SavedCollectionRow[]
  isLoading: boolean
  isFetching: boolean
  touch: (collectionId: string) => void
  remove: (collectionId: string) => void
}

const defaultSavedCollectionsState: SavedCollectionsState = {
  data: [],
  isLoading: false,
  isFetching: false,
  touch: () => {},
  remove: () => {},
}

export type PinnedCollectionsState = {
  data: PinnedCollectionItemRow[]
  isLoading: boolean
  isFetching: boolean
  touch: (collectionId: string) => void
  remove: (collectionId: string) => void
}

const defaultPinnedCollectionsState: PinnedCollectionsState = {
  data: [],
  isLoading: false,
  isFetching: false,
  touch: () => {},
  remove: () => {},
}

type CollectionsState = {
  preferenceState: PreferenceState
  savedCollectionsState: SavedCollectionsState
  pinnedCollectionsState: PinnedCollectionsState
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
    savedCollectionsState: defaultSavedCollectionsState,
    pinnedCollectionsState: defaultPinnedCollectionsState,
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

  const savedCollectionsQuery = useSavedCollections()
  const touchSavedCollectionMutation = useTouchSavedCollection()
  const removeSavedCollectionMutation = useRemoveSavedCollection()
  const savedCollectionsState: SavedCollectionsState = {
    data: savedCollectionsQuery.data ?? [],
    isLoading: savedCollectionsQuery.isLoading,
    isFetching: savedCollectionsQuery.isFetching,
    touch: (collectionId) => touchSavedCollectionMutation.mutate(collectionId),
    remove: (collectionId) => removeSavedCollectionMutation.mutate(collectionId),
  }

  const pinnedCollectionsQuery = usePinnedCollections()
  const touchPinnedCollectionMutation = useTouchPinnedCollection()
  const removePinnedCollectionMutation = useRemovePinnedCollection()
  const pinnedCollectionsState: PinnedCollectionsState = {
    data: pinnedCollectionsQuery.data ?? [],
    isLoading: pinnedCollectionsQuery.isLoading,
    isFetching: pinnedCollectionsQuery.isFetching,
    touch: (collectionId) => touchPinnedCollectionMutation.mutate(collectionId),
    remove: (collectionId) => removePinnedCollectionMutation.mutate(collectionId),
  }

  const storeRef = useRef<StoreApi<CollectionsState> | null>(null)
  if (!storeRef.current) storeRef.current = createCollectionPageStore(preferencesState)

  // Keep zustand store in sync when preferences change
  useEffect(() => {
    storeRef.current?.setState({ preferenceState: preferencesState })
  }, [preferencesState])

  useEffect(() => {
    storeRef.current?.setState({ savedCollectionsState })
  }, [savedCollectionsState])

  useEffect(() => {
    storeRef.current?.setState({ pinnedCollectionsState })
  }, [pinnedCollectionsState])

  return <CollectionPageContext.Provider value={storeRef.current} {...props} />
}

export const useCollectionsPageStore = () => {
  const store = useContext(CollectionPageContext)
  if (!store)
    throw new Error('useCollectionsPageStore must be used within CreateNewCollectionsProvider')
  return useStore(store)
}
