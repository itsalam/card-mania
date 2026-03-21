import { useToast } from '@/components/Toast'
import { getSupabase } from '@/lib/store/client'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

export function useOfferRealtime() {
  const qc = useQueryClient()
  const { showToast } = useToast()

  useEffect(() => {
    const supabase = getSupabase()
    let sellerChannel: ReturnType<typeof supabase.channel> | null = null
    let buyerChannel: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id
      if (!userId) return

      sellerChannel = supabase
        .channel(`offers-seller-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'offers',
            filter: `seller_id=eq.${userId}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: ['offers', 'seller'] })
            showToast({ message: 'New offer received!' })
          }
        )
        .subscribe()

      buyerChannel = supabase
        .channel(`offers-buyer-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'offers',
            filter: `buyer_id=eq.${userId}`,
          },
          (payload) => {
            qc.invalidateQueries({ queryKey: ['offers', 'buyer'] })
            const status = (payload.new as { status?: string }).status
            if (status === 'accepted') {
              showToast({ message: 'Your offer was accepted!' })
            } else if (status === 'declined') {
              showToast({ message: 'Your offer was declined!' })
            } else {
              showToast({ message: `Your offer was ${status ?? 'updated'}.` })
            }
          }
        )
        .subscribe()
    })

    return () => {
      if (sellerChannel) supabase.removeChannel(sellerChannel)
      if (buyerChannel) supabase.removeChannel(buyerChannel)
    }
  }, [qc, showToast])
}
