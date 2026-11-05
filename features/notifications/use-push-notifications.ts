import { isPushPlatform, registerForPush } from '@/client/notifications/push'
import { getSupabase } from '@/lib/store/client'
import { useUserStore } from '@/lib/store/useUserStore'
import { reportError } from '@/lib/utils/report-error'
import { useQueryClient } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useEffect } from 'react'

/**
 * Registers the device token whenever a real (non-anonymous) user is signed in and push
 * permission is already granted. Never prompts — the OS prompt is shown contextually from the
 * Notifications tab or the notification settings page.
 */
export function usePushRegistration() {
  const userId = useUserStore((s) => (s.user && !s.user.is_anonymous ? s.user.id : null))
  const status = useUserStore((s) => s.status)

  useEffect(() => {
    if (!isPushPlatform || !userId || status !== 'authenticated') return
    registerForPush({ prompt: false }).catch((error) =>
      reportError({ context: 'usePushRegistration', error })
    )
  }, [userId, status])
}

/**
 * Opens a tapped push's action_url and marks its notification read. Must run inside the root
 * layout (not the providers) so the navigator exists when a cold-start tap is replayed.
 * Pattern from https://docs.expo.dev/router/reference/notifications/
 */
export function usePushResponseObserver() {
  const qc = useQueryClient()

  useEffect(() => {
    if (!isPushPlatform) return

    const open = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as {
        notification_id?: string
        action_url?: string | null
      }
      if (data?.notification_id) {
        getSupabase()
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', data.notification_id)
          .is('read_at', null)
          .then(({ error }) => {
            if (error) reportError({ context: 'usePushResponseObserver', error })
            qc.invalidateQueries({ queryKey: ['notifications'] })
          })
      }
      router.push((data?.action_url || '/notifications') as Parameters<typeof router.push>[0])
    }

    const last = Notifications.getLastNotificationResponse()
    if (last) {
      open(last)
      Notifications.clearLastNotificationResponse()
    }

    const sub = Notifications.addNotificationResponseReceivedListener(open)
    return () => sub.remove()
  }, [qc])
}
