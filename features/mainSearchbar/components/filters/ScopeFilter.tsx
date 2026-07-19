import { FadeScrollView } from '@/components/ui/fade-scroll'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import React from 'react'
import { View } from 'react-native'
import { FilterBadge } from './FilterBadge'
import { useFilters } from './providers'

export function ScopeFilter() {
  const { scope, setScope } = useFilters()
  return (
    <View className="flex flex-row gap-2 items-center">
      <Text className="text-lg font-medium">Item Type</Text>
      <Separator orientation="vertical" />

      <FadeScrollView horizontal style={{ flex: 1 }}>
        <View className="flex-row gap-2">
          <FilterBadge
            filterKey="marketplace"
            checked={scope === 'marketplace'}
            onCheckedChange={() => setScope('marketplace')}
          />
          <FilterBadge
            filterKey="catalog"
            checked={scope === 'catalog'}
            onCheckedChange={() => setScope('catalog')}
          />
        </View>
      </FadeScrollView>
    </View>
  )
}
