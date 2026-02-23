import { Text } from '@/components/ui/text'
import { ArrowRight } from 'lucide-react-native'
import { View } from 'react-native'
import { LiquidGlassCard } from '../../components/tcg-card/GlassCard'

export function GridCard() {
  return (
    <View className="flex flex-col items-center justify-center">
      <LiquidGlassCard
        variant="primary"
        className="p-4 justify-center flex items-center"
        style={{
          height: 120,
          aspectRatio: 5 / 7,
          borderRadius: 12,
        }}
      />
      <View className="flex flex-row items-center">
        <Text className="text-center mt-2 text-sm">$15.99</Text>
        <ArrowRight size={12} className="pt-4" />
        <Text className="text-center mt-2 text-sm">$15.99</Text>
      </View>
    </View>
  )
}
