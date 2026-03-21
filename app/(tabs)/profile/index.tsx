import ProfilePageLayout from '@/features/profile'
import { useUserStore } from '@/lib/store/useUserStore'

const ProfilePage = () => {
  const userStore = useUserStore()
  return <ProfilePageLayout userId={userStore.user?.id} isSelf={true} />
}

export default ProfilePage
