import React, { createContext, useContext, useEffect, useRef } from 'react'
import { createStore, StoreApi, useStore } from 'zustand'

import { UserProfile, useUserProfile } from '../settings/client'

export type TabType = 'collections' | 'posts' | 'timeline' | 'stats' | 'storefront' | 'seeking'
type TabData = {
  label?: string
}

export const tabsRecords: Record<TabType, TabData> = {
  collections: {
    label: 'Collections',
  },
  posts: {
    label: 'Posts',
  },
  timeline: {
    label: 'Timeline',
  },
  stats: {
    label: 'Stats',
  },
  storefront: {
    label: 'Storefront',
  },
  seeking: {
    label: 'Seeking',
  },
}

export const defaultTab: TabType[] = ['collections', 'posts']

type ProfilePageStore = {
  user?: Partial<UserProfile>
  currentTab: TabType
  setCurrentTab: (page: TabType) => void
  setTabs: (tabs: TabType[]) => void
  tabs: TabType[]
}

export function makeTabs(opts: { isHobbyist?: boolean; isTrader?: boolean }): TabType[] {
  if (opts.isTrader) return ['storefront', 'collections', 'posts']
  return ['collections', 'posts']
}

export function createUserProfilePageStore(initial: {
  tabs: TabType[]
  user?: Partial<UserProfile>
}) {
  return createStore<ProfilePageStore>((set) => ({
    ...initial,
    currentTab: initial.tabs.includes('storefront')
      ? 'storefront'
      : (initial.tabs[0] ?? 'collections'),
    setCurrentTab: (page) => set({ currentTab: page }),
    setTabs: (tabs) =>
      set((s) => ({
        tabs,
        // keep currentPage valid
        currentTab: tabs.includes(s.currentTab) ? s.currentTab : (tabs[0] ?? 'collections'),
      })),
  }))
}

const Ctx = createContext<StoreApi<ProfilePageStore> | null>(null)

export function UserProfilePageStoreProvider({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  const { data: user, ...error } = useUserProfile(userId)
  const tabs = makeTabs({
    isHobbyist: user?.is_hobbyiest,
    isTrader: user?.is_seller,
  })

  // create store ONCE
  const storeRef = useRef<StoreApi<ProfilePageStore> | null>(null)
  if (!storeRef.current) {
    storeRef.current = createUserProfilePageStore({ user, tabs })
  }

  // update tabs when profile loads/changes; prefer storefront when available
  useEffect(() => {
    storeRef.current!.setState((s) => ({
      tabs,
      currentTab: tabs.includes('storefront')
        ? 'storefront'
        : tabs.includes(s.currentTab)
          ? s.currentTab
          : (tabs[0] ?? 'collections'),
    }))
  }, [tabs.join('|')])

  useEffect(() => {
    storeRef.current!.setState({ user })
  }, [user])

  return <Ctx.Provider value={storeRef.current}>{children}</Ctx.Provider>
}

export function useUserProfilePage<T>(selector: (s: ProfilePageStore) => T) {
  const store = useContext(Ctx)
  if (!store) throw new Error('useUserProfilePage must be used within UserProfilePageStoreProvider')
  return useStore(store, selector)
}
