import { getSupabase } from '@/lib/store/client'
import type { OnboardingStateFlags } from '@/lib/store/types'
import AsyncStorage from '@react-native-async-storage/async-storage'

const deviceKey = (userId: string) => `cardmania:onboardingState:${userId}`

export function isOnboardingDone(state: OnboardingStateFlags | null | undefined): boolean {
  return state?.profile_setup === true && state?.tour === true
}

export async function readDeviceOnboardingState(
  userId: string
): Promise<OnboardingStateFlags | null> {
  const raw = await AsyncStorage.getItem(deviceKey(userId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as OnboardingStateFlags
  } catch {
    return null
  }
}

export async function writeDeviceOnboardingState(
  userId: string,
  state: OnboardingStateFlags
): Promise<void> {
  await AsyncStorage.setItem(deviceKey(userId), JSON.stringify(state))
}

export async function getOnboardingState(userId: string): Promise<OnboardingStateFlags> {
  const { data } = await getSupabase()
    .from('user_profile')
    .select('onboarding_state')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.onboarding_state as OnboardingStateFlags | null) ?? {}
}

/**
 * Device-first resolution for onboarding gating. The on-device cache is
 * always read first. The database is only consulted when nothing is cached
 * yet — once the device cache shows onboarding fully complete (end state),
 * that's terminal and the database is never read for it again.
 */
export async function resolveOnboardingState(userId: string): Promise<OnboardingStateFlags> {
  const device = await readDeviceOnboardingState(userId)

  if (device !== null && isOnboardingDone(device)) {
    return device
  }

  const remote = await getOnboardingState(userId)
  await writeDeviceOnboardingState(userId, remote)
  return remote
}

/** Read-modify-write merge so concurrent flags (e.g. profile_setup vs tour) don't clobber each other. */
export async function patchOnboardingState(
  userId: string,
  patch: Partial<OnboardingStateFlags>
): Promise<OnboardingStateFlags> {
  const current = await getOnboardingState(userId)
  const next = { ...current, ...patch }
  const { error } = await getSupabase()
    .from('user_profile')
    .upsert({ user_id: userId, onboarding_state: next }, { onConflict: 'user_id' })
  if (error) throw error
  await writeDeviceOnboardingState(userId, next)
  return next
}
