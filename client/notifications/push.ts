// Expo push registration + preferences (ITS-60 / ITS-62). The server side is
// supabase/migrations/20261106000000_push_notifications.sql + the push-dispatch function.
//
// Native only: on web every entry point is a no-op. Push doesn't work on simulators, so
// registration quietly reports 'unsupported' there.
import { getSupabase } from '@/lib/store/client'
import { reportError } from '@/lib/utils/report-error'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { NotificationCategory } from './types'

const TOKEN_STORAGE_KEY = 'push-token'
const PROMPTED_STORAGE_KEY = 'push-permission-prompted'
export const isPushPlatform = Platform.OS === 'ios' || Platform.OS === 'android'

export type PushPreferences = {
  enabled: boolean
  categories: Record<NotificationCategory, boolean>
  quiet_hours: { enabled: boolean; start: string; end: string; tz: string }
}

export type PushPreferencesPatch = {
  enabled?: boolean
  categories?: Partial<PushPreferences['categories']>
  quiet_hours?: Partial<PushPreferences['quiet_hours']>
}

export type PushRegistration = 'registered' | 'denied' | 'undetermined' | 'unsupported'

if (isPushPlatform) {
  // The in-app realtime toast (useOfferRealtime) already covers the foreground case, so a
  // push arriving while the app is open only lands in the notification list + badge.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  })
}

// Channel ids must match channelFor() in supabase/functions/_shared/expo-push.ts.
async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('offers', {
    name: 'Offers & transactions',
    importance: Notifications.AndroidImportance.HIGH,
  })
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
  })
}

/**
 * Registers this device's Expo push token for the signed-in user. Only shows the OS prompt
 * when `prompt` is true and the user hasn't answered yet; otherwise registers silently if
 * permission was already granted.
 */
export async function registerForPush({ prompt }: { prompt: boolean }): Promise<PushRegistration> {
  if (!isPushPlatform || !Device.isDevice) return 'unsupported'

  await ensureAndroidChannels()
  let { status, canAskAgain } = await Notifications.getPermissionsAsync()
  if (status !== 'granted' && prompt && canAskAgain) {
    await AsyncStorage.setItem(PROMPTED_STORAGE_KEY, '1')
    ;({ status } = await Notifications.requestPermissionsAsync())
  }
  if (status !== 'granted') return status === 'denied' ? 'denied' : 'undetermined'

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })

  const { error } = await getSupabase().rpc('register_push_token', {
    p_token: token,
    p_platform: Platform.OS,
    p_device_name: Device.deviceName ?? Device.modelName ?? undefined,
  })
  if (error) throw error
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token)
  return 'registered'
}

/** Detaches this device from the current account. Call while the session is still valid. */
export async function unregisterPush() {
  if (!isPushPlatform) return
  const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY)
  if (!token) return
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY)
  const { error } = await getSupabase().rpc('unregister_push_token', { p_token: token })
  if (error) reportError({ context: 'unregisterPush', error })
}

/** True once we've shown the OS prompt from a contextual entry point. */
export async function hasPromptedForPush() {
  return (await AsyncStorage.getItem(PROMPTED_STORAGE_KEY)) === '1'
}

export const pushPreferencesKey = ['push-preferences'] as const

export function usePushPreferences(enabled = true) {
  return useQuery({
    queryKey: pushPreferencesKey,
    enabled,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_push_preferences')
      if (error) throw error
      return data as unknown as PushPreferences
    },
    staleTime: 5 * 60_000,
  })
}

/** Toggle-style: applies the patch to the cache immediately, rolls back on error. */
export function useSetPushPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: PushPreferencesPatch) => {
      const { data, error } = await getSupabase().rpc('set_push_preferences', {
        p_patch: patch as never,
      })
      if (error) throw error
      return data as unknown as PushPreferences
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: pushPreferencesKey })
      const prev = qc.getQueryData<PushPreferences>(pushPreferencesKey)
      if (prev) {
        qc.setQueryData<PushPreferences>(pushPreferencesKey, {
          ...prev,
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          categories: { ...prev.categories, ...patch.categories },
          quiet_hours: { ...prev.quiet_hours, ...patch.quiet_hours },
        })
      }
      return { prev }
    },
    onError: (error, patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(pushPreferencesKey, ctx.prev)
      reportError({ context: 'useSetPushPreferences', error, metadata: { patch } })
    },
    onSuccess: (data) => {
      qc.setQueryData(pushPreferencesKey, data)
    },
  })
}

/** The device's IANA zone, sent with quiet-hours edits so the server evaluates them locally. */
export const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
