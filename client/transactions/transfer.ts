// ITS-135: where a sale's cards are, as the transaction screen describes it. The server holds
// the seller's copies when the offer is accepted and moves them to the buyer's Vault when the
// buyer confirms receipt (docs/collections/ownership-transfer.md).

import { TransactionStatus } from '@/client/offers/types'

export function collectionTransferLabel(isBuyer: boolean, status: TransactionStatus) {
  if (status === 'completed') {
    return isBuyer ? 'Added to your Vault' : 'Sold: removed from your collection'
  }
  if (status === 'disputed') return 'On hold while the dispute is open'
  return isBuyer
    ? 'Moves to your Vault when you confirm receipt'
    : 'On hold until the buyer confirms receipt'
}
