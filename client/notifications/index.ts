import { getSupabase } from '@/lib/store/client'
import { requireUser } from '@/lib/store/functions/helpers'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppNotification, NotificationCategory } from './types'

export function useNotifications(opts: { unread?: boolean; category?: NotificationCategory }) {
  const { unread, category } = opts
  return useQuery({
    queryKey: ['notifications', category, unread],
    queryFn: async () => {
      const user = await requireUser()
      const supabase = getSupabase()

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })

      if (unread === true) {
        query = query.is('read_at', null)
      } else if (unread === false) {
        query = query.not('read_at', 'is', null)
      }

      if (category) {
        query = query.eq('category', category)
      }

      const { data, error } = await query
      if (error) throw error
      return (data as AppNotification[]) ?? []
    },
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const user = await requireUser()
      const supabase = getSupabase()

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null)
        .is('dismissed_at', null)

      if (error) throw error
      return count ?? 0
    },
    select: (data) => data as number,
  })
}

export function useMarkRead(id: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const user = await requireUser()
      const supabase = getSupabase()
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })
}

export function useDismissNotification(id: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('notifications')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })
}
