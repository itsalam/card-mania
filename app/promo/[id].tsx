import { PromoScreen } from '@/features/promos/PromoScreen'
import { useLocalSearchParams } from 'expo-router'

export default function PromoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <PromoScreen id={id} />
}
