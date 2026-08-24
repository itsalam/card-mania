import { create } from 'zustand'

type TabBarStore = {
  hideCount: number
  push: () => void
  pop: () => void
}

/** Counter-based so overlapping hide requests (e.g. navigating from one full-screen
 *  transparentModal straight into another) don't let an unmounting screen's `pop()`
 *  prematurely reveal the tab bar while another hider is still mounted. */
export const useTabBarStore = create<TabBarStore>((set) => ({
  hideCount: 0,
  push: () => set((s) => ({ hideCount: s.hideCount + 1 })),
  pop: () => set((s) => ({ hideCount: Math.max(0, s.hideCount - 1) })),
}))
