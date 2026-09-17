// store.ts
import { create } from 'zustand'

export const tabValues = ['feed', 'explore', 'sheets']
export type TabValue = (typeof tabValues)[number]

export type ExploreLayout = 'grid' | 'list'

type PageState = {
  currentPage: string
  exploreLayout: ExploreLayout
  setCurrentPage: (page: string) => void
  setExploreLayout: (layout?: string) => void
}

export const useHomePageStore = create<PageState>((set) => ({
  currentPage: tabValues[0],
  exploreLayout: 'grid',
  setExploreLayout: (layout) => set({ exploreLayout: (layout as ExploreLayout) ?? 'grid' }),
  setCurrentPage: (page) => set({ currentPage: page }),
}))
