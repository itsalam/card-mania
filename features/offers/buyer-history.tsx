import { Offer } from '@/client/offers/types'
import { OfferActions, OfferHistory, OfferTurnStrip } from './negotiation'
import { OfferCardBase } from './ui'

export function BuyerOfferCard({ offer }: { offer: Offer }) {
  return (
    <OfferCardBase
      offer={offer}
      counterpartyId={offer.seller_id}
      afterHeader={<OfferTurnStrip offer={offer} role="buyer" />}
      history={<OfferHistory offer={offer} role="buyer" />}
    >
      <OfferActions offer={offer} role="buyer" />
    </OfferCardBase>
  )
}
