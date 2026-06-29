import { GradientBackground } from '@/components/Background'
import MarketplaceScreen from '@/features/marketplace'

export default function MarketplacePage() {
  return (
    <GradientBackground style={{ flex: 1 }}>
      <MarketplaceScreen />
    </GradientBackground>
  )
}
