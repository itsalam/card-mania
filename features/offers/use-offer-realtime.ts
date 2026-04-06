import { useToast } from '@/components/Toast'
import { getSupabase } from '@/lib/store/client'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppNotification } from '@/client/notifications/types'

export function useOfferRealtime() {
  const qc = useQueryClient()
  const { showToast } = useToast()

  useEffect(() => {
    const supabase = getSupabase()
    let channel: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id
      if (!userId) return

      channel = supabase
        .channel(`notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const notification = payload.new as AppNotification

            qc.invalidateQueries({ queryKey: ['notifications'] })
            qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })

            if (notification.category === 'offer') {
              qc.invalidateQueries({ queryKey: ['offers', 'seller'] })
              qc.invalidateQueries({ queryKey: ['offers', 'buyer'] })
            }

            showToast({ title: notification.title, message: notification.body })
          }
        )
        .subscribe()
    })

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [qc, showToast])
}
