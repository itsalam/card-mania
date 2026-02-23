import { createContext, PropsWithChildren, useContext, useMemo, useRef } from 'react'
import { TextInput } from 'react-native'
import { create } from 'zustand'

type ItemType = 'cards' | 'sets' | 'collections'

type Filters = {
  itemTypes: ItemType[]
  priceRange: {
    min?: number
    max?: number
  }
  sealed: boolean
  owned: boolean
  wishlisted: boolean
  unowned: boolean
}

export type FiltersKeys = keyof Filters | ItemType

type FilterActions = {
  toggleItemTypes: (type: ItemType) => void
  setPriceRange: (min?: number, max?: number) => void
  setSealed: (sealed: boolean) => void
  setOwned: (owned: boolean) => void
  setWishlisted: (wishlisted: boolean) => void
  setUnowned: (unowned: boolean) => void
  toggleDisplayFilter: (filter: FiltersKeys) => void
}

type FilterState = Filters & FilterActions

type FilterDisplayState = {
  displayFilters: Partial<Record<keyof typeof DisplayFilterLabels | ItemType, string>>
}

export const DisplayFilterLabels = {
  cards: 'Cards',
  sets: 'Sets',
  collections: 'Collections',
  priceRange: 'Price Range',
  sealed: 'Sealed',
  owned: 'Owned',
  wishlisted: 'Wishlisted',
  unowned: 'Unowned',
} as Record<FiltersKeys, string>

export const useFiltersStore = create<FilterState>((set) => ({
  itemTypes: [],
  priceRange: {},
  sealed: false,
  owned: false,
  wishlisted: false,
  unowned: false,
  toggleItemTypes: (type) =>
    set((state) => ({
      itemTypes: state.itemTypes.includes(type)
        ? state.itemTypes.filter((t) => t !== type)
        : [...state.itemTypes, type],
    })),
  setPriceRange: (min, max) => set({ ...{ priceRange: { min, max } } }),
  setSealed: (sealed) => set({ sealed }),
  setOwned: (owned) => set({ owned }),
  setWishlisted: (wishlisted) => set({ wishlisted }),
  setUnowned: (unowned) => set({ unowned }),
  toggleDisplayFilter: (filter) =>
    set((state) => {
      if (filter in DisplayFilterLabels) {
        const key = filter as keyof Filters
        if (key === 'priceRange') {
          return { priceRange: { min: undefined, max: undefined } }
        }
        if (state[key]) {
          delete state[key]
        } else {
          // focus the filter
        }
        return { ...state }
      } else {
        const itemTypes = state.itemTypes
        if (itemTypes.includes(filter as ItemType)) {
          return { itemTypes: itemTypes.filter((type) => type !== (filter as ItemType)) }
        } else {
          return { itemTypes: [...itemTypes, filter as ItemType] }
        }
      }
    }),
}))

type KeyboardActions = {
  focusInput: React.RefObject<TextInput | null>
  ignoreNextBlur: React.RefObject<boolean>
}

const FiltersContext = createContext<(FilterState & FilterDisplayState & KeyboardActions) | null>(
  null
)

export function FiltersProvider({
  children,
  filters,
}: PropsWithChildren & { filters: FilterState }) {
  const { min, max } = filters.priceRange
  const displayFilters = useMemo(() => {
    const { itemTypes, priceRange, sealed, owned, wishlisted, unowned } = filters

    const itemLabels = itemTypes.reduce(
      (acc, type) => {
        acc[type] = DisplayFilterLabels[type]
        return acc
      },
      {} as Record<ItemType, string>
    )

    const hasMin = priceRange.min != null // treat 0 as valid
    const hasMax = priceRange.max != null
    const priceLabel =
      hasMin && hasMax
        ? `${priceRange.min} - ${priceRange.max}`
        : hasMin
          ? `Over ${priceRange.min}`
          : hasMax
            ? `Under ${priceRange.max}`
            : undefined

    return {
      ...itemLabels,
      ...(priceLabel ? { priceRange: priceLabel } : {}),
      ...(sealed ? { sealed: DisplayFilterLabels.sealed } : {}),
      ...(owned ? { owned: DisplayFilterLabels.owned } : {}),
      ...(wishlisted ? { wishlisted: DisplayFilterLabels.wishlisted } : {}),
      ...(unowned ? { unowned: DisplayFilterLabels.unowned } : {}),
    } as FilterDisplayState['displayFilters']
  }, [filters, min, max])

  const focusInput = useRef<TextInput>(null)
  const ignoreNextBlur = useRef(false)

  return (
    <FiltersContext.Provider value={{ ...filters, displayFilters, focusInput, ignoreNextBlur }}>
      {children}
    </FiltersContext.Provider>
  )
}

export function useFilters() {
  const context = useContext(FiltersContext)
  if (!context) {
    throw new Error('useFilters must be used within FiltersProvider')
  }
  return context
}
