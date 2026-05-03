import ProfilePageLayout from '@/features/profile'
import { useLocalSearchParams } from 'expo-router'

export default function UserProfilePage() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  return <ProfilePageLayout userId={userId} />
}
