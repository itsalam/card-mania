import { getSupabase } from '@/lib/store/client'
import { Json } from '@/lib/store/supabase'
import { useUserStore } from '@/lib/store/useUserStore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient, useMutation } from '@tanstack/react-query'
import React, { createContext, useCallback, useMemo, useRef } from 'react'
import preformAction from './actions'
import { userPreferenceStorageKey, UserProfile, useUserProfile } from './client'
import { getLeafSubpaths, useSettingsLayout } from './helpers'
import { SettingsLayoutSection, SettingsType } from './types'

type Preferences = UserProfile['preferences'] | null | undefined

type ContextValue = {
  preferences: Preferences
  isLoading: boolean
  updatePreferences: (partial: Record<string, Json | undefined>) => Promise<unknown>
  updateSettings: (path: string[], value: Json, type?: SettingsType) => Promise<unknown>
  sections: Record<string, SettingsLayoutSection>
}

const ProfileSettingsContext = createContext<ContextValue | undefined>(undefined)

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const deepMerge = (
  base: Record<string, Json | undefined>,
  patch: Record<string, Json | undefined>
): Record<string, Json | undefined> => {
  const result: Record<string, Json | undefined> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = deepMerge(base[key] as Record<string, Json>, value)
    } else {
      result[key] = value
    }
  }
  return result
}

export const ProfileSettingsProvider = ({
  children,
  qc,
}: {
  children: React.ReactNode
  qc: QueryClient
}) => {
  const { user } = useUserStore()
  const { data: profile, isLoading } = useUserProfile(user?.id)
  const { sections } = useSettingsLayout()

  const originalPrefsRef = useRef<Preferences>(profile?.preferences ?? null)

  // keep ref in sync when profile updates
  if (profile?.preferences !== originalPrefsRef.current) {
    originalPrefsRef.current = profile?.preferences ?? null
  }

  const currentPrefs = useMemo(
    () => (profile?.preferences ?? {}) as Record<string, Json>,
    [profile?.preferences]
  )

  const mutation = useMutation({
    mutationFn: async (nextPrefs: Record<string, Json | undefined>) => {
      if (!user?.id) throw new Error('No user logged in')
      // write-through to local cache first for instant availability
      await AsyncStorage.setItem(userPreferenceStorageKey(user.id), JSON.stringify(nextPrefs))

      const { data, error } = await getSupabase()
        .from('user_profile')
        .upsert(
          {
            user_id: user.id,
            preferences: nextPrefs,
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      if (user?.id) {
        qc.setQueryData(['user-profile', user.id], data)
      }
    },
  })

  const updatePreferences = useCallback(
    async (partial: Record<string, Json | undefined>) => {
      const merged = deepMerge(currentPrefs, partial)

      const actionPromise = preformAction(merged, getLeafSubpaths(partial)[0])
      // Optimistically update local state & query cache so downstream hooks (sections) refresh immediately

      return actionPromise.then(({ updates, hasUpdated }) => {
        if (!hasUpdated) return
        const finalSettings = deepMerge(currentPrefs, updates)
        if (user?.id) {
          originalPrefsRef.current = finalSettings
          qc.setQueryData(['user-profile', user.id], (prev: any) => ({
            ...(prev ?? {}),
            preferences: finalSettings,
          }))
        }
        return mutation.mutateAsync(finalSettings)
      })
    },
    [currentPrefs, mutation, qc, user?.id]
  )

  const updateSettings = useCallback(
    async (path: string[], value: Json) => {
      if (!path.length) return
      const settingsUpdate: Record<string, Json> = {}
      let cursor: any = settingsUpdate

      path.forEach((key, idx) => {
        const isLeaf = idx === path.length - 1
        if (isLeaf) {
          cursor[key] = value
        } else {
          if (
            typeof cursor[key] !== 'object' ||
            cursor[key] === null ||
            Array.isArray(cursor[key])
          ) {
            cursor[key] = {}
          }
          cursor = cursor[key]
        }
      })

      return updatePreferences(settingsUpdate)
    },
    [updatePreferences]
  )

  const value = useMemo<ContextValue>(
    () => ({
      preferences: originalPrefsRef.current ?? {},
      isLoading: isLoading || mutation.isPending,
      updatePreferences,
      updateSettings,
      sections,
    }),
    [isLoading, mutation.isPending, updatePreferences, updateSettings, sections]
  )

  return <ProfileSettingsContext.Provider value={value}>{children}</ProfileSettingsContext.Provider>
}
