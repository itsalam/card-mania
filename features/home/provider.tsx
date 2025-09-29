// store.ts
import { create } from 'zustand';

export const tabValues = ['feed', 'explore', 'sheets'];
export type TabValue = typeof tabValues[number];

type PageState = {
  currentPage: string;
  exploreLayout: string;
  setCurrentPage: (page: string) => void;
  setExploreLayout: (layout: string) => void;
}

export const useHomePageStore = create<PageState>((set) => ({
  currentPage: tabValues[0],
exploreLayout: 'grid',
  setExploreLayout: (layout) => set({ exploreLayout: layout }),
  setCurrentPage: (page) => set({ currentPage: page }),
}))
