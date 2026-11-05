import { TransactionStatus } from '@/client/offers/types'

export type TransactionActions = {
  markShipped: boolean
  confirmReceipt: boolean
  dispute: boolean
}

/**
 * Which action buttons a party sees on a transaction: the seller ships a `pending` one, the buyer
 * confirms receipt of a `shipped` one, and either can dispute while it's still open (when
 * `disputesEnabled`). Returns null when there's nothing to show, so the action bar can skip
 * rendering entirely. Kept free of UI imports so the matrix is unit-testable.
 */
export function getTransactionActions({
  isSeller,
  status,
  disputesEnabled,
}: {
  isSeller: boolean
  status: TransactionStatus
  disputesEnabled: boolean
}): TransactionActions | null {
  if (status === 'completed' || status === 'disputed') return null
  const actions = {
    markShipped: isSeller && status === 'pending',
    confirmReceipt: !isSeller && status === 'shipped',
    dispute: disputesEnabled,
  }
  return actions.markShipped || actions.confirmReceipt || actions.dispute ? actions : null
}
