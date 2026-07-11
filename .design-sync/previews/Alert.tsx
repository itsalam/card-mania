import { Alert, AlertTitle, AlertDescription } from 'card-mania'

export const Default = () => (
  <Alert>
    <AlertTitle>Heads up</AlertTitle>
    <AlertDescription>Price alerts are active for this card.</AlertDescription>
  </Alert>
)

export const Destructive = () => (
  <Alert variant="destructive">
    <AlertTitle>Payment failed</AlertTitle>
    <AlertDescription>Your card was declined. Please update your payment method.</AlertDescription>
  </Alert>
)
