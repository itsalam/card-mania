import { getSupabase } from '@/lib/store/client'
import { reportError } from '@/lib/utils/report-error'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { TransactionMessage } from './types'

export function useTransactionMessages(transactionId: string | undefined) {
  return useQuery({
    queryKey: ['transaction-messages', transactionId] as const,
    enabled: Boolean(transactionId),
    queryFn: async (): Promise<TransactionMessage[]> => {
      const { data, error } = await (getSupabase() as any)
        .from('transaction_messages')
        .select('*')
        .eq('transaction_id', transactionId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as TransactionMessage[]
    },
  })
}

export function useSendTransactionMessage() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      transactionId,
      senderId,
      content,
    }: {
      transactionId: string
      senderId: string
      content: string
    }) => {
      const { data, error } = await (getSupabase() as any)
        .from('transaction_messages')
        .insert({ transaction_id: transactionId, sender_id: senderId, content })
        .select()
        .single()
      if (error || !data) throw error ?? new Error('Failed to send message')
      return data as TransactionMessage
    },
    onMutate: async ({ transactionId, senderId, content }) => {
      const queryKey = ['transaction-messages', transactionId] as const
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData<TransactionMessage[]>(queryKey) ?? []
      const optimistic: TransactionMessage = {
        id: `optimistic-${Date.now()}`,
        transaction_id: transactionId,
        sender_id: senderId,
        content,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData(queryKey, [...prev, optimistic])
      return { prev }
    },
    onError: (err, { transactionId }, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(['transaction-messages', transactionId], ctx.prev)
      }
      reportError({ context: 'useSendTransactionMessage', error: err })
    },
    onSettled: (_, __, { transactionId }) => {
      qc.invalidateQueries({ queryKey: ['transaction-messages', transactionId] })
    },
  })
}

export function useTransactionMessageRealtime(transactionId: string | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!transactionId) return

    const supabase = getSupabase()
    const channel = supabase
      .channel(`transaction-messages-${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_messages',
          filter: `transaction_id=eq.${transactionId}`,
        },
        (payload) => {
          const newMsg = payload.new as TransactionMessage
          qc.setQueryData<TransactionMessage[]>(['transaction-messages', transactionId], (prev) => {
            if (!prev) return [newMsg]
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev.filter((m) => !m.id.startsWith('optimistic-')), newMsg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [transactionId, qc])
}
