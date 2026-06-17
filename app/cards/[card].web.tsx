import WebCardDetailPage from '@/features/web/WebCardDetailPage'
import { useLocalSearchParams } from 'expo-router'

export default function CardWebRoute() {
  const { card } = useLocalSearchParams<{ card: string }>()
  return <WebCardDetailPage cardId={card ?? ''} />
}
