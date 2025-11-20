import { GradientBackground } from '@/components/Background'
import HomeScreen from '@/features/home'

export default function HomePage() {
  return (
    <GradientBackground className="w-full h-full flex-1">
      <HomeScreen />
    </GradientBackground>
  )
}
