import React, { createContext, useContext, useEffect, useRef } from 'react'
import { StoreApi, useStore, createStore } from 'zustand'

import { User } from '@supabase/supabase-js'
import { UserProfile, useUserProfile } from '../settings/client'

export type TabType = 'collections' | 'timeline' | 'stats' | 'storefront' | 'seeking'
type TabData = {
  label?: string
}

export const tabsRecords: Record<TabType, TabData> = {
  collections: {
    label: 'Collections',
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
    label: 'seeking',
  },
}

export const defaultTab: TabType[] = ['collections', 'timeline', 'stats']

type ProfilePageStore = {
  user?: UserProfile
  currentTab: TabType
  setCurrentTab: (page: TabType) => void
  setTabs: (tabs: TabType[]) => void
  tabs: TabType[]
}

type UserProfilePageOpts = {
  user: User
}
export function makeTabs(opts: { isHobbyist?: boolean; isTrader?: boolean }): TabType[] {
  const tabs: TabType[] = ['collections', 'timeline', 'stats']
  if (opts.isHobbyist) tabs.unshift('seeking')
  if (opts.isTrader) tabs.unshift('storefront')
  return tabs
}

export function createUserProfilePageStore(initial: { tabs: TabType[]; user?: UserProfile }) {
  return createStore<ProfilePageStore>((set) => ({
    ...initial,
    currentTab: initial.tabs[0] ?? 'collections',
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
  const { data: user } = useUserProfile(userId)
  const tabs = makeTabs({
    isHobbyist: user?.is_hobbyiest,
    isTrader: user?.is_seller,
  })

  // create store ONCE
  const storeRef = useRef<StoreApi<ProfilePageStore> | null>(null)
  if (!storeRef.current) {
    storeRef.current = createUserProfilePageStore({ user, tabs })
  }

  // update tabs when profile loads/changes
  useEffect(() => {
    storeRef.current!.setState((s) => ({
      ...s,
      tabs,
      currentPage: tabs.includes(s.currentTab) ? s.currentTab : (tabs[0] ?? 'collections'),
    }))
  }, [tabs.join('|')]) // or use a stable hash

  useEffect(() => {
    storeRef.current!.setState((s) => ({
      ...s,
      user,
    }))
  }, [user]) // or use a stable hash

  return <Ctx.Provider value={storeRef.current}>{children}</Ctx.Provider>
}

export function useUserProfilePage<T>(selector: (s: ProfilePageStore) => T) {
  const store = useContext(Ctx)
  if (!store) throw new Error('useUserProfilePage must be used within UserProfilePageStoreProvider')
  return useStore(store, selector)
}
