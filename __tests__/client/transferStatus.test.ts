import { collectionTransferLabel } from '@/client/transactions/transfer'

describe('collectionTransferLabel', () => {
  it('describes the hold before completion', () => {
    expect(collectionTransferLabel(false, 'pending')).toBe(
      'On hold until the buyer confirms receipt'
    )
    expect(collectionTransferLabel(true, 'shipped')).toBe(
      'Moves to your Vault when you confirm receipt'
    )
  })

  it('reports the transfer once completed', () => {
    expect(collectionTransferLabel(true, 'completed')).toBe('Added to your Vault')
    expect(collectionTransferLabel(false, 'completed')).toBe('Sold: removed from your collection')
  })

  it('keeps disputed sales on hold for both sides', () => {
    expect(collectionTransferLabel(true, 'disputed')).toBe('On hold while the dispute is open')
    expect(collectionTransferLabel(false, 'disputed')).toBe('On hold while the dispute is open')
  })
})
