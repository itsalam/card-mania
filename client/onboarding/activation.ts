import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { useUserStore } from '@/lib/store/useUserStore'
import { useQuery } from '@tanstack/react-query'

export type ActivationStatus = {
  has_storefront: boolean
  has_collection_item: boolean
  has_offer: boolean
  activated: boolean
}

/**
 * Live-derived activation status for the signed-in user — see ITS-51's recorded
 * decision: a user is "activated" once they have ANY of a listed storefront, a
 * collection item, or a sent/received offer. Backed by the get_activation_status() RPC,
 * which reads storefronts/collection_items/offers directly rather than a stored flag, so
 * this can never drift out of sync with the source data the way a manually-maintained
 * onboarding_state flag could.
 *
 * Callers that perform one of the three underlying actions (list a storefront, add a
 * collection item, send an offer) should invalidate qk.activationStatus(userId) in their
 * own onSuccess/onSettled — see useEditCollection, useEditCollectionItem, and
 * useSubmitOffer — so this reflects the change immediately rather than waiting out
 * staleTime. Received offers are covered by useOfferRealtime's notification handler.
 */
export function useActivationStatus() {
  const userId = useUserStore((s) => s.user?.id)
  return useQuery({
    queryKey: qk.activationStatus(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_activation_status').single()
      if (error) throw error
      return data as ActivationStatus
    },
    staleTime: 30_000,
  })
}
