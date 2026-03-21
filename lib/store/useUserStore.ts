// store/useUserStore.ts
import { getSupabase } from '@/lib/store/client'
import type { AuthStatusType, Profile } from '@/lib/store/types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
type State = {
  status: AuthStatusType
  session: Session | null
  user: User | null

  profile: Profile | null
  hydrated: boolean // for UI guards
  error?: string
}

type Actions = {
  setHydrated: () => void
  setStatus: (s: AuthStatusType) => void
  setAuth: (session: Session | null) => Promise<void>
  loadProfile: (userId: string) => Promise<void>
  signOut: () => Promise<void>
  signInAnonymously: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithFacebook: () => Promise<void>
  signInWithApple: () => Promise<void>
}

export const AuthStatus = {
  IDLE: 'idle',
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  SIGNED_OUT: 'signed_out',
  ERROR: 'error',
} as const

export const useUserStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      status: 'idle',
      session: null,
      user: null,
      profile: null,
      hydrated: false,

      setHydrated: () => set({ hydrated: true }),
      setStatus: (status) => set({ status }),

      setAuth: async (session) => {
        const user = session?.user ?? null
        set({
          session,
          user,
          status: user ? 'authenticated' : 'signed_out',
          error: undefined,
        })

        if (user) {
          await get().loadProfile(user.id)
          // Optionally subscribe to profile changes:
          getSupabase()
            .channel(`public:user_profiles:id=eq.${user.id}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${user.id}`,
              },
              async () => {
                await get().loadProfile(user.id)
              }
            )
            .subscribe()
        } else {
          set({ profile: null })
        }
      },

      loadProfile: async (userId) => {
        const { data, error } = await getSupabase()
          .from('user_profile')
          .select('*')
          .eq('id', userId)
          .single()

        if (error) {
          set({ error: error.message })
        } else {
          set({ profile: data as Profile, error: undefined })
        }
      },

      signOut: async () => {
        try {
          await getSupabase().auth.signOut()
        } catch (error) {
          console.error(error)
        } finally {
          set({
            session: null,
            user: null,
            profile: null,
            status: 'signed_out',
          })
        }
      },
      signInAnonymously: async () => {
        let session: Session | null = null
        let user: User | null = null
        let error: Error | null = null
        if (process.env.NODE_ENV !== 'production') {
          const { data, error: demoError } = await getSupabase().auth.signInWithPassword({
            email: 'cardmania_demo@demo.com',
            password: '123456',
          })
          session = data.session
          user = data.user
          error = demoError
        } else {
          const { data, error: anonError } = await getSupabase().auth.signInAnonymously()
          session = data.session
          user = data.user
          error = anonError ?? null
        }
        if (error) {
          throw error
        }
        set({ session, user, status: 'authenticated' })
      },
      signInWithGoogle: async () => {
        alert('not implemented')
      },
      signInWithFacebook: async () => {
        alert('not implemented')
      },
      signInWithApple: async () => {
        alert('not implemented')
      },
    }),
    {
      name: 'user-store', // persists profile + minor UI flags; not tokens
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only what’s safe/needed between runs:
      partialize: (s) => ({
        profile: s.profile,
        hydrated: s.hydrated,
      }),
      onRehydrateStorage: () => (state) => {
        // mark hydrated after zustand rehydrates
        state?.setHydrated()
      },
    }
  )
)
