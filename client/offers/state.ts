// ITS-140: client-side mirror of the offer state machine in
// supabase/migrations/20261124000000_its140_offer_state_machine.sql. The server is the
// authority; these helpers only decide what to show. Spec: docs/offers/state-machine.md.

import { Offer, OfferStatus } from './types'

export type OfferRole = 'buyer' | 'seller'

/** Statuses still under negotiation: someone owes a response. */
export const OPEN_STATUSES: readonly OfferStatus[] = ['pending', 'countered']

/** ITS-145 "Active": open, or accepted and still moving through the transaction. */
export const ACTIVE_STATUSES: readonly OfferStatus[] = ['pending', 'countered', 'accepted']

/** Whose move it is: the seller answers `pending`, the buyer answers `countered`. */
export function offerResponder(status: OfferStatus): OfferRole | null {
  if (status === 'pending') return 'seller'
  if (status === 'countered') return 'buyer'
  return null
}

/**
 * The status to show. The expirer runs every few minutes, so an open offer whose window
 * has passed is shown as expired before the row catches up (the RPCs reject it either way).
 */
export function effectiveOfferStatus(
  offer: Pick<Offer, 'status' | 'expires_at'>,
  now = Date.now()
): OfferStatus {
  if (
    OPEN_STATUSES.includes(offer.status) &&
    offer.expires_at &&
    Date.parse(offer.expires_at) <= now
  ) {
    return 'expired'
  }
  return offer.status
}

/** True when `role` can accept or counter right now. */
export function isMyTurn(
  offer: Pick<Offer, 'status' | 'expires_at'>,
  role: OfferRole,
  now = Date.now()
): boolean {
  const status = effectiveOfferStatus(offer, now)
  return offerResponder(status) === role
}

/** "2d 4h", "5h 12m", "8m" — time left until `expiresAt`, or null once it has passed. */
export function formatTimeLeft(expiresAt: string, now = Date.now()): string | null {
  const ms = Date.parse(expiresAt) - now
  if (!Number.isFinite(ms) || ms <= 0) return null
  const totalMinutes = Math.max(1, Math.floor(ms / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export type OfferStatusFilter = OfferStatus | 'active'

export const OFFER_STATUS_FILTERS: { value: OfferStatusFilter | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'countered', label: 'Countered' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
]

/** An empty selection matches everything; otherwise any selected filter may match. */
export function matchesStatusFilters(
  offer: Pick<Offer, 'status' | 'expires_at'>,
  filters: ReadonlySet<OfferStatusFilter>,
  now = Date.now()
): boolean {
  if (filters.size === 0) return true
  const status = effectiveOfferStatus(offer, now)
  if (filters.has(status)) return true
  return filters.has('active') && ACTIVE_STATUSES.includes(status)
}
