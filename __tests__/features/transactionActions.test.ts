import { TransactionStatus } from '@/client/offers/types'
import { getTransactionActions } from '@/features/transactions/actions'

// ITS-120: the action bar's empty check skipped markShipped, so a seller on native (disputes off)
// never saw "Mark as Shipped" and transactions stalled at pending.
describe('getTransactionActions', () => {
  const cases: [TransactionStatus, boolean, boolean, ReturnType<typeof getTransactionActions>][] = [
    // status, isSeller, disputesEnabled, expected
    ['pending', true, false, { markShipped: true, confirmReceipt: false, dispute: false }],
    ['pending', false, false, null],
    ['shipped', true, false, null],
    ['shipped', false, false, { markShipped: false, confirmReceipt: true, dispute: false }],
    ['pending', true, true, { markShipped: true, confirmReceipt: false, dispute: true }],
    ['pending', false, true, { markShipped: false, confirmReceipt: false, dispute: true }],
    ['shipped', true, true, { markShipped: false, confirmReceipt: false, dispute: true }],
    ['shipped', false, true, { markShipped: false, confirmReceipt: true, dispute: true }],
    ['completed', true, true, null],
    ['completed', false, true, null],
    ['disputed', true, true, null],
    ['disputed', false, true, null],
  ]

  it.each(cases)('%s, seller=%s, disputes=%s', (status, isSeller, disputesEnabled, expected) => {
    expect(getTransactionActions({ isSeller, status, disputesEnabled })).toEqual(expected)
  })
})
