import { Separator } from '@/components/ui/separator'
import {
  AnimatedTabsContent,
  Tabs,
  TabsLabel,
  TabsScrollList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { DollarSign, Layers, Shapes, X } from 'lucide-react-native'
import { AnimatePresence } from 'moti'
import React, { useState } from 'react'
import { Dimensions, ScrollView, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { CategoryFilter } from './CategoryFilter'
import { FilterBadge } from './FilterBadge'
import { GenreFilter } from './GenreFilter'
import { GradingFilter } from './GradingFilter'
import PriceFilter from './PriceFilter'
import { FiltersKeys, useFilters } from './providers'
import { ScopeFilter } from './ScopeFilter'
import { AttributeFilter } from './SealedFilter'
import { SetFilter } from './SetFilter'
const AnimatedView = Animated.createAnimatedComponent(View)

type SearchFilterView = 'type' | 'details' | 'sets' | 'price'

const tabs = [
  { value: 'type', label: 'Type', icon: Shapes },
  { value: 'collections', label: 'Collections', icon: Layers },
  { value: 'price', label: 'Prices', icon: DollarSign },
]

export function SearchFiltersOptions() {
  const { priceRange } = useFilters()
  const [view, setView] = useState<SearchFilterView>('type')
  const height = Math.max(Dimensions.get('screen').height / 4, 252)
  const width = Math.max(Dimensions.get('screen').width)
  return (
    <Tabs
      style={{
        display: 'flex',
        overflow: 'hidden',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        height: height,
        width,
      }}
      value={view}
      onValueChange={(val) => setView(val as SearchFilterView)}
    >
      <TabsScrollList
        style={{
          // Match the previous TabsList overrides
          // paddingVertical: 0,
          marginHorizontal: 8,
          alignSelf: 'stretch',
          zIndex: -1,
        }}
      >
        {tabs.map(({ value, label, icon }, index) => (
          <TabsTrigger
            key={value}
            value={value}
            style={{
              flexGrow: 0,
              flexShrink: 0,
              marginVertical: 3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TabsLabel
              label={label}
              value={value}
              iconLeft={icon}
              style={{
                padding: 4,
                paddingBottom: 2,
                fontSize: 18,
                color: value === view ? Colors.$textDefault : Colors.$textNeutral,
              }}
            />
          </TabsTrigger>
        ))}
      </TabsScrollList>

      <View style={{ flex: 1, alignSelf: 'stretch', position: 'relative' }}>
        <AnimatedTabsContent
          value="type"
          style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 10 }}
        >
          <ScopeFilter />
          <Separator orientation="horizontal" />
          <CategoryFilter />
          <Separator orientation="horizontal" />
          <AttributeFilter />
          <Separator orientation="horizontal" />
          <GradingFilter />
        </AnimatedTabsContent>

        <AnimatedTabsContent value="collections" style={{ paddingVertical: 8 }}>
          <GenreFilter />
          <SetFilter label="Set" />
        </AnimatedTabsContent>
        <AnimatedTabsContent value="price">
          <PriceFilter min={priceRange.min} max={priceRange.max} absMin={0} absMax={1000} />
        </AnimatedTabsContent>
      </View>
    </Tabs>
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
                <X width={14} height={14} color="white" />
              </FilterBadge>
            ))}
          </AnimatePresence>
        </View>
      </ScrollView>
    </View>
  )
}
