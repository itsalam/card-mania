import { PromoPreviewScreen } from '@/features/promos/PromoPreviewScreen'
import { useLocalSearchParams } from 'expo-router'

export default function PromoPreviewRoute() {
  const { id, token } = useLocalSearchParams<{ id: string; token?: string }>()
  return <PromoPreviewScreen id={id} token={token} />
}
