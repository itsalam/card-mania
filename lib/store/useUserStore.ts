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
  profileSetupComplete: boolean | null // null = not yet loaded
  hydrated: boolean
  error?: string
}

type Actions = {
  setHydrated: () => void
  setStatus: (s: AuthStatusType) => void
  setAuth: (session: Session | null) => Promise<void>
  loadProfile: (userId: string) => Promise<void>
  updateProfile: (patch: Partial<Profile>) => Promise<void>
  setProfileSetupComplete: (v: boolean) => Promise<void>
  verifySignUpOtp: (email: string, token: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>
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
      profileSetupComplete: null,
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
          // Subscribe to live profile changes
          getSupabase()
            .channel(`public:user_profile:user_id=eq.${user.id}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'user_profile',
                filter: `user_id=eq.${user.id}`,
              },
              async () => {
                await get().loadProfile(user.id)
              }
            )
            .subscribe()
        } else {
          set({ profile: null, profileSetupComplete: null })
        }
      },

      loadProfile: async (userId) => {
        const [profileRes, settingsRes] = await Promise.all([
          getSupabase().from('user_profile').select('*').eq('user_id', userId).maybeSingle(),
          getSupabase()
            .from('user_settings')
            .select('profile_setup_complete')
            .eq('user_id', userId)
            .maybeSingle(),
        ])

        if (profileRes.error) {
          set({ error: profileRes.error.message })
        } else {
          set({
            profile: profileRes.data as Profile | null,
            profileSetupComplete: settingsRes.data?.profile_setup_complete ?? false,
            error: undefined,
          })
        }
      },

      updateProfile: async (patch) => {
        const userId = get().user?.id
        if (!userId) return
        await getSupabase()
          .from('user_profile')
          .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
        await get().loadProfile(userId)
      },

      setProfileSetupComplete: async (v) => {
        const userId = get().user?.id
        if (!userId) return
        set({ profileSetupComplete: v })
        const { error } = await getSupabase()
          .from('user_settings')
          .upsert({ user_id: userId, profile_setup_complete: v }, { onConflict: 'user_id' })
        if (error) console.error('[setProfileSetupComplete] DB write failed:', error.message)
      },

      verifySignUpOtp: async (email, token) => {
        const { data, error } = await getSupabase().auth.verifyOtp({ email, token, type: 'signup' })
        if (error) throw error
        if (data.session) await get().setAuth(data.session)
      },

      signIn: async (email, password) => {
        set({ status: 'loading', error: undefined })
        const { error } = await getSupabase().auth.signInWithPassword({ email, password })
        if (error) {
          set({ status: 'error', error: error.message })
          throw error
        }
        // onAuthStateChange in _providers.tsx drives the rest of the state update
      },

      signUp: async (email, password) => {
        const { data, error } = await getSupabase().auth.signUp({ email, password })
        if (error) throw error

        const user = data.user
        if (!user) throw new Error('Sign up succeeded but no user was returned.')

        if (data.session) {
          // Email confirmation disabled — session is live immediately
          await get().setAuth(data.session)
        }

        return { needsEmailConfirmation: !data.session }
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
            profileSetupComplete: null,
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
        if (error) throw error
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
      name: 'user-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        profile: s.profile,
        profileSetupComplete: s.profileSetupComplete,
        hydrated: s.hydrated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated()
      },
    }
  )
)
