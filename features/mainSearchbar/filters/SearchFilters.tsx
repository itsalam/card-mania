import { Separator } from '@/components/ui/separator'
import { X } from 'lucide-react-native'
import { AnimatePresence } from 'moti'
import React from 'react'
import { ScrollView, View } from 'react-native'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { CategoryFilter } from './CategoryFilter'
import PriceFilter from './PriceFilter'
import { FiltersKeys, useFilters } from './providers'
import { AttributeFilter } from './SealedFilter'
import { FilterBadge } from './ToggleBadge'
const AnimatedView = Animated.createAnimatedComponent(View)

export function SearchFiltersOptions({
  expanded,
  focused,
}: {
  expanded: boolean
  focused: boolean
}) {
  const { priceRange } = useFilters()
  const scrollViewStyle = useAnimatedStyle(() => {
    return {
      maxHeight: withTiming(expanded ? 1000 : 0, { duration: 200 }),
      paddingTop: expanded ? 8 : 0,
    }
  })
  return (
    <View className="w-full pb-2">
      <ScrollView keyboardShouldPersistTaps="always">
        <AnimatedView style={scrollViewStyle} className="flex-col gap-2">
          <Separator orientation='horizontal' />
          <CategoryFilter />
          <Separator orientation='horizontal' />
          <PriceFilter min={priceRange.min} max={priceRange.max} absMin={0} absMax={1000} />
          <Separator orientation='horizontal' />
          <AttributeFilter />
        </AnimatedView>
      </ScrollView>
    </View>
  )
}

export function SearchFilters({ focused }: { focused: boolean }) {
  const { displayFilters, toggleDisplayFilter } = useFilters()
  if (!focused || Object.entries(displayFilters).length === 0) return null
  return (
    <View className="w-full overflow-visible">
      <ScrollView horizontal keyboardShouldPersistTaps="always" keyboardDismissMode="none">
        <View className="flex-row gap-2 pt-2">
          <AnimatePresence>
            {Object.entries(displayFilters).map(([key, value]) => (
              <FilterBadge
                checked
                onCheckedChange={() => toggleDisplayFilter(key as FiltersKeys)}
                key={key}
                filterKey={key as FiltersKeys}
                title={value}
              >
                <X width={14} height={14} color="white"/>
              </FilterBadge>
            ))}
          </AnimatePresence>
        </View>
      </ScrollView>
    </View>
  )
}
