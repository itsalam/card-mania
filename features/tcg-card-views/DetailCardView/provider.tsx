import { usePopulateTagCategory } from '@/client/collections/tags'
import { TCard, TTag } from '@/constants/types'
import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { createStore, StoreApi, useStore } from 'zustand'
import { VISIBILITY_OPTIONS } from './ui'

export type CardDetailsStore = {
  card: TCard | null
  footerPages: Array<{ title: string; page: () => React.ReactNode }>
  currentPage?: number
  setPage: (pageIdx: number) => void
  setCard: (card: TCard | null) => void
  setFooterPages: (pages: Array<{ title: string; page: () => React.ReactNode }>) => void
  footerFullView: boolean
  setFooterFullView: (value: boolean) => void
}

export const createCardDetailsStore = ({
  card,
  footerPages,
  currentPage = 0,
}: {
  card?: TCard | null
  footerPages?: Array<{ title: string; page: () => React.ReactNode }>
  currentPage?: number
}) =>
  createStore<CardDetailsStore>((set, get) => ({
    card: card ?? null,
    footerPages: footerPages ?? [],
    currentPage,
    setCard: (card: TCard | null) => set({ card }),
    setPage: (pageIdx) => {
      const pages = get().footerPages
      if (pageIdx < 0 || pageIdx >= pages.length) return
      set({ currentPage: pageIdx })
    },
    setFooterPages: (pages) => set({ footerPages: pages }),
    footerFullView: false,
    setFooterFullView: (value) => set({ footerFullView: value }),
  }))

const CardDetailsContext = createContext<StoreApi<CardDetailsStore> | null>(null)

export const CardDetailsProvider = ({
  card,
  children,
  footerPages,
}: {
  card?: TCard | null
  children: React.ReactNode
  footerPages: Array<{ title: string; page: () => React.ReactNode }>
}) => {
  // create one store instance for this provider
  const storeRef = useRef<StoreApi<CardDetailsStore> | null>(null)

  if (!storeRef.current) {
    storeRef.current = createCardDetailsStore({
      card: card ?? null,
      footerPages,
      currentPage: 0,
    })
  }

  // Only effects may update the store
  useEffect(() => {
    storeRef.current!.setState({ card: card ?? null }, false)
  }, [card])

  useEffect(() => {
    // If footerPages is re-created every render, consider memoizing it upstream
    storeRef.current!.setState({ footerPages }, false)
  }, [footerPages])

  return (
    <CardDetailsContext.Provider value={storeRef.current}>{children}</CardDetailsContext.Provider>
  )
}

export function useCardDetails() {
  const store = useContext(CardDetailsContext)
  if (!store) throw new Error('useCardDetails must be used within CardDetailsProvider')
  return useStore(store)
}

export type VisibilityKey = (typeof VISIBILITY_OPTIONS)[number]['key']

export type TagDraft = Partial<TTag & { category?: string }>

type CollectionState = {
  name: string
  description: string
  visibility: VisibilityKey // use a stable key, not an index
  tags: TagDraft[]
}

type OptionalState = {
  isStoreFront: boolean
  hideSoldItems: boolean
}

export type CreateNewCollectionsState = CollectionState &
  Partial<OptionalState> & {
    requestedTags: TagDraft[]
    isValid: Record<keyof CollectionState, boolean> | boolean

    // actions (pure)
    setName(name: string): void
    setDescription(description: string): void
    setVisibility(v: VisibilityKey): void
    setTags(tags: TagDraft[]): void
    setRequestedTags(tags: TagDraft[]): void
    setValid(isValid: Record<keyof CollectionState, boolean> | boolean): void
    setStoreOptions({ isStoreFront, hideSoldItems }: Partial<OptionalState>): void
    validate(): boolean

    // helper to merge/normalize requested tags after categorization
    applyRequestedTagCategories(
      map: Map<string, { tag_id?: string; category_slugs?: string[] }>
    ): void
  }

export function createNewCollectionsStore() {
  return createStore<CreateNewCollectionsState>((set, get) => ({
    name: '',
    description: '',
    visibility: 'public',
    tags: [],
    requestedTags: [],
    isStoreFront: false,
    hideSoldItems: false,
    isValid: false,
    setName: (name) => set({ name }),
    setDescription: (description) => set({ description }),
    setVisibility: (visibility) => set({ visibility }),
    setTags: (tags) => set({ tags }),
    setRequestedTags: (requestedTags) => set({ requestedTags }),
    setValid: (isValid) => set({ isValid }),
    setStoreOptions: ({ isStoreFront, hideSoldItems }: Partial<OptionalState>) =>
      set({ isStoreFront, hideSoldItems }),
    validate: () => {
      const { name, description, visibility, tags } = get()
      const isValid = {
        name: name.length >= 3,
        description: description.length >= 0, // optional
        visibility: ['public', 'private', 'unlisted'].includes(visibility),
        tags: tags.length >= 0, // optional
      }
      if (Object.values(isValid).every(Boolean)) {
        set({ isValid: true })
        return true
      } else {
        set({ isValid })
        return false
      }
    },
    applyRequestedTagCategories: (map) => {
      const { requestedTags, tags } = get()
      const next = requestedTags.map((t, i) => {
        const entry = map.get((t.name ?? '').toString().trim().toLowerCase())
        const category = entry?.category_slugs?.[0] ?? 'general'
        return {
          ...t,
          id: (t.id as string) ?? entry?.tag_id ?? `new-${t.name}-${i}`,
          category,
        }
      })
      const existingTagNames = new Set(tags.map((t) => t.name))
      for (const t of next) {
        if (!existingTagNames.has(t.name as string)) {
          tags.push(t)
        }
      }
      set({ tags: [...tags], requestedTags: [] })
    },
  }))
}

const Ctx = createContext<StoreApi<CreateNewCollectionsState> | null>(null)

export function CreateNewCollectionsProvider({ children }: { children: React.ReactNode }) {
  // create once
  const storeRef = useRef<StoreApi<CreateNewCollectionsState> | null>(null)
  if (!storeRef.current) storeRef.current = createNewCollectionsStore()

  // derive category info for requested tags, then apply into the store
  const requested = useStore(storeRef.current, (s) => s.requestedTags)
  const namesNeedingLookup = useMemo(
    () => requested.filter((t) => !t.id && !t.name).map((t) => String(t.name!)),
    [requested]
  )

  const { map } = usePopulateTagCategory(namesNeedingLookup)
  useEffect(() => {
    if (map) storeRef.current!.getState().applyRequestedTagCategories(map)
  }, [map])

  return <Ctx.Provider value={storeRef.current}>{children}</Ctx.Provider>
}

export function useCreateNewCollections<T>(selector: (s: CreateNewCollectionsState) => T): T {
  const store = useContext(Ctx)
  if (!store)
    throw new Error('useCreateNewCollections must be used within CreateNewCollectionsProvider')
  return useStore(store, selector)
}
