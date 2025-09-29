import { ExpandableCard, ExpandedContent } from "@/components/content-card";
import { LiquidGlassCard } from "@/components/tcg-card/GlassCard";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react-native";
import { View } from "react-native";


export function AvailableNow() {
  return (
    <ExpandableCard
      variant="ghost"
      title="Wishlist Hits"
      items={[]}
      itemWidth={120}
      containerClassNames="gap-6 px-6"
      renderItem={({ isOpen }) => (
        <View className={cn('flex flex-col items-center gap-2', isOpen && 'flex-row')}>
            <LiquidGlassCard variant="primary" style={{
                width: 96, 
                aspectRatio: 5 / 7,
            }}/>

          <View className="flex-1">

          {isOpen && <ExpandedContent />}
            <View className="flex flex-row items-center">
            <Text className="text-center mt-2 text-sm">
              $15.99
            </Text> 
            <ArrowRight size={12} className="mt-4"/>
            <Text className="text-center mt-2 text-sm">
              $15.99
            </Text> 
            
            </View>

          </View>
        </View>
      )}
    />
  )
}
