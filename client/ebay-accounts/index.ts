import { getSupabase } from '@/lib/store/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type EbayAccount = {
  id: string
  user_id: string
  ebay_username: string
  marketplace_id: string
  connected_at: string
  updated_at: string
}

const QUERY_KEY = ['ebay-account'] as const

export function useEbayAccount() {
  return useQuery<EbayAccount | null>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('user_ebay_accounts')
        .select('id, user_id, ebay_username, marketplace_id, connected_at, updated_at')
        .maybeSingle()
      if (error) throw error
      return data as EbayAccount | null
    },
    staleTime: 5 * 60_000,
  })
}

export function useDisconnectEbay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().from('user_ebay_accounts').delete().neq('id', '')
      if (error) throw error
    },
    onSuccess: () => {
      qc.setQueryData(QUERY_KEY, null)
    },
  })
}
