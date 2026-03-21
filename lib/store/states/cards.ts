import { TCard } from '@/constants/types'
import { create } from 'zustand'
import { devtools, persist, PersistStorage } from 'zustand/middleware'

type FetchState<T> = {
  data?: T
  error?: string
  loading: boolean
  prefetchData?: Partial<T>
  updatedAt?: number
}

export type CardStoreState = {
  cards: Record<string, FetchState<TCard>>
  setCard: (id: string, data: TCard) => void
  setPrefetchData: (id: string, data: Partial<TCard>) => void
  reset: () => void
  isHydrated: boolean
  _setHydrated: (v: boolean) => void
}

export type CardStorePersist = Pick<CardStoreState, 'cards'>

export type CardPersistStorageFactory = () => PersistStorage<CardStorePersist> | undefined

export const makeCardStore = (createStorage: CardPersistStorageFactory | undefined) => {
  return create<CardStoreState>()(
    devtools(
      persist(
        (set, get) => ({
          cards: {},

          setCard(id: string, data: TCard) {
            set((s) => ({
              cards: {
                ...s.cards,
                [id]: {
                  ...(s.cards[id] ?? { loading: false }),
                  data,
                  error: undefined,
                  loading: false,
                  updatedAt: Date.now(),
                },
              },
            }))
          },

          setPrefetchData: (id, data) => {
            set((state) => ({
              cards: { ...state.cards, [id]: { ...(state.cards[id] ?? {}), prefetchData: data } },
            }))
          },
          reset() {
            set({ cards: {} })
          },
          _setHydrated: (v) =>
            set((s) => {
              s.isHydrated = v
              return s
            }),
          isHydrated: false,
        }),
        {
          name: 'cardmania-store',
          storage: createStorage?.(),
          onRehydrateStorage: () => (state, error) => {
            state?._setHydrated(true)
            // Called before/after hydration; good place to fix migrations
          },
          partialize: ({ isHydrated, cards }) => ({ isHydrated, cards }), // don’t persist large caches
        }
      )
    )
  )
}
