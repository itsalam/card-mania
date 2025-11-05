import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text'
import React from 'react'
import { ScrollView, View } from 'react-native'
import { FilterBadge } from './FilterBadge'
import { useFilters } from './providers'

export function CategoryFilter() {
  const { itemTypes, toggleItemTypes } = useFilters()
  return (
    <View className="flex flex-row gap-2 items-center">
      <Text className="text-lg font-medium">Item Type</Text>
      <Separator orientation="vertical" />

      <ScrollView horizontal>
        <View className="flex-row gap-2">
          <FilterBadge
            filterKey="cards"
            checked={itemTypes.includes('cards')}
            onCheckedChange={() => toggleItemTypes('cards')}
          />
          <FilterBadge
            filterKey="sets"
            checked={itemTypes.includes('sets')}
            onCheckedChange={() => toggleItemTypes('sets')}
          />
          <FilterBadge
            filterKey="collections"
            checked={itemTypes.includes('collections')}
            onCheckedChange={() => toggleItemTypes('collections')}
          />
        </View>
      </ScrollView>
    </View>
  )
}
