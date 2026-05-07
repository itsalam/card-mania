import { TransactionScreen } from '@/features/transactions'
import { useLocalSearchParams } from 'expo-router'

export default function TransactionRoute() {
  const { offerId } = useLocalSearchParams<{ offerId: string }>()
  return <TransactionScreen offerId={offerId} />
}
