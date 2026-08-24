// store/useUserStore.ts
import { getSupabase } from '@/lib/store/client'
import {
  patchOnboardingState,
  resolveOnboardingState,
  writeDeviceOnboardingState,
} from '@/lib/store/onboardingState'
import type { AuthStatusType, OnboardingStateFlags, Profile } from '@/lib/store/types'
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
  onboardingState: OnboardingStateFlags | null // device-first resolved onboarding flags; null = not yet resolved
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
  signInWithPhone: (phone: string, shouldCreateUser?: boolean) => Promise<void>
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>
  checkEmailRegistered: (email: string) => Promise<boolean>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password?: string) => Promise<{ needsEmailConfirmation: boolean }>
  setPassword: (password: string) => Promise<void>
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

export function useRequiredUserId() {
  const id = useUserStore((s) => s.user?.id)
  if (!id) throw new Error('User required')
  return id
}

const profileChannelName = (userId: string) => `public:user_profile:user_id=eq.${userId}`

// `getSupabase().channel(name)` returns the *same* channel instance for a
// repeated name rather than creating a new one — so without this guard,
// calling `.on().subscribe()` again on an already-subscribed channel throws
// "cannot add `postgres_changes` callbacks ... after `subscribe()`". This
// matters because `onAuthStateChange` (app/_providers.tsx) re-runs `setAuth`
// with the same user on every token refresh, not just on initial sign-in.
function isChannelSubscribed(name: string) {
  const topic = `realtime:${name}`
  return getSupabase()
    .getChannels()
    .some((c) => c.topic === topic)
}

export const useUserStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      status: 'idle',
      session: null,
      user: null,
      profile: null,
      profileSetupComplete: null,
      onboardingState: null,
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
          // Device-first: resolve onboarding gating from the on-device cache
          // before anything else proceeds. Only falls through to the DB when
          // the cache is empty; once the cache shows onboarding fully done,
          // the DB is never read for it.
          const onboardingState = await resolveOnboardingState(user.id)
          set({ onboardingState, profileSetupComplete: onboardingState.profile_setup ?? false })

          await get().loadProfile(user.id)
          // Only subscribe to live profile changes for real (non-anonymous) users.
          // Guarded — setAuth re-runs on every onAuthStateChange event (e.g. token
          // refresh), and re-subscribing an already-subscribed channel throws.
          const channelName = profileChannelName(user.id)
          if (!user.is_anonymous && !isChannelSubscribed(channelName)) {
            getSupabase()
              .channel(channelName)
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
          }
        } else {
          set({ profile: null, profileSetupComplete: null, onboardingState: null })
        }
      },

      loadProfile: async (userId) => {
        const profileRes = await getSupabase()
          .from('user_profile')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()

        if (profileRes.error) {
          set({ error: profileRes.error.message })
        } else {
          const profile = profileRes.data as Profile | null
          const onboardingState = profile?.onboarding_state ?? {}
          set({
            profile,
            onboardingState,
            profileSetupComplete: onboardingState.profile_setup ?? false,
            error: undefined,
          })
          // Keep the device cache in sync with whatever the DB says (e.g. a
          // realtime update from onboarding progress made on another device).
          await writeDeviceOnboardingState(userId, onboardingState)
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
        set((s) => ({
          profileSetupComplete: v,
          onboardingState: { ...s.onboardingState, profile_setup: v },
        }))
        try {
          await patchOnboardingState(userId, { profile_setup: v })
        } catch (error: any) {
          console.error('[setProfileSetupComplete] DB write failed:', error.message)
        }
      },

      verifySignUpOtp: async (email, token) => {
        const { data, error } = await getSupabase().auth.verifyOtp({ email, token, type: 'signup' })
        if (error) throw error
        if (data.session) {
          AsyncStorage.setItem('cardmania:hasEverSignedIn', '1').catch(() => {})
          await get().setAuth(data.session)
        }
      },

      signInWithPhone: async (phone, shouldCreateUser = false) => {
        console.log('[signInWithPhone] sending OTP', { phone, shouldCreateUser })
        const { error } = await getSupabase().auth.signInWithOtp({
          phone,
          options: { shouldCreateUser },
        })
        if (error) {
          console.error('[signInWithPhone] error', {
            code: error.code,
            status: error.status,
            message: error.message,
          })
          throw error
        }
        console.log('[signInWithPhone] OTP sent successfully')
      },

      verifyPhoneOtp: async (phone, token) => {
        console.log('[verifyPhoneOtp] verifying OTP', { phone, tokenLength: token.length })
        const { data, error } = await getSupabase().auth.verifyOtp({ phone, token, type: 'sms' })
        if (error) {
          console.error('[verifyPhoneOtp] error', {
            code: error.code,
            status: error.status,
            message: error.message,
          })
          throw error
        }
        console.log('[verifyPhoneOtp] success', {
          hasSession: !!data.session,
          userId: data.user?.id,
        })
        if (data.session) {
          AsyncStorage.setItem('cardmania:hasEverSignedIn', '1').catch(() => {})
          await get().setAuth(data.session)
        }
      },

      checkEmailRegistered: async (email) => {
        const { data, error } = await (getSupabase() as any).rpc('check_email_registered', {
          p_email: email,
        })
        if (error) throw error
        return !!data
      },

      signIn: async (email, password) => {
        set({ status: 'loading', error: undefined })
        const { data, error } = await getSupabase().auth.signInWithPassword({ email, password })
        if (error) {
          set({ status: 'error', error: error.message })
          throw error
        }
        // Fire setAuth without awaiting so signIn() returns as soon as the credential
        // check succeeds. setAuth() synchronously sets session/user/status, then
        // awaits loadProfile() — blocking on that would keep the caller (AuthModal)
        // waiting with the modal open even though auth already succeeded.
        if (data.session) {
          AsyncStorage.setItem('cardmania:hasEverSignedIn', '1').catch(() => {})
          get().setAuth(data.session).catch(console.error)
        }
      },

      signUp: async (email, password) => {
        // If no password provided, generate a random temp one — user sets real password in onboarding.
        const tmp =
          password ??
          Array.from(
            { length: 32 },
            () =>
              'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
                Math.floor(Math.random() * 62)
              ]
          ).join('')
        const { data, error } = await getSupabase().auth.signUp({ email, password: tmp })
        if (error) throw error

        const user = data.user
        if (!user) throw new Error('Sign up succeeded but no user was returned.')

        if (data.session) {
          // Email confirmation disabled — session is live immediately
          await get().setAuth(data.session)
        }

        return { needsEmailConfirmation: !data.session }
      },

      setPassword: async (password) => {
        const { error } = await getSupabase().auth.updateUser({ password })
        if (error) throw error
      },

      signOut: async () => {
        // Clear state synchronously first so the UI re-renders immediately.
        // auth.signOut() and signInAnonymously() are async and may wait on the
        // Supabase auth lock — deferring the set() to their finally/callback
        // would leave the UI stale for the full duration of those awaits.
        set({
          session: null,
          user: null,
          profile: null,
          profileSetupComplete: null,
          onboardingState: null,
          status: 'signed_out',
        })
        // Drop the outgoing user's profile-changes channel — it's scoped to their
        // id, so left alone it would just sit idle, but the next signInAnonymously
        // could otherwise queue behind a stale (still-subscribing) channel of the
        // same name if it fires again before this one settles.
        const profileChannelPrefix = 'realtime:public:user_profile:user_id=eq.'
        for (const channel of getSupabase().getChannels()) {
          if (channel.topic.startsWith(profileChannelPrefix)) {
            getSupabase().removeChannel(channel)
          }
        }
        // scope: 'local' clears the session in storage without a server roundtrip.
        // The access token expires server-side on its own TTL.
        try {
          await getSupabase().auth.signOut({ scope: 'local' })
        } catch (error) {
          console.error('[signOut]', error)
        }
        // Re-establish an anon session so RLS-gated storefront reads continue to
        // work for unauthenticated browsing.
        try {
          await getSupabase().auth.signInAnonymously()
        } catch (err) {
          console.warn('[signOut] anonymous re-sign-in failed:', err)
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
