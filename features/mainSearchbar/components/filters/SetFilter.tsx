import { useCardSets } from '@/client/price-charting'
import { ToggleBadge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import React from 'react'
import { ScrollView, View } from 'react-native'
import { useFilters } from './providers'

/**
 * ITS-91 set multi-select (filter sheet). Options come from list_card_sets(),
 * scoped to the selected canonical genre so the list stays bounded.
 */
export function SetFilter() {
  const { genre, setNames, toggleSet } = useFilters()
  const { data: options = [] } = useCardSets(genre)

  if (!options.length) return null

  return (
    <View className="flex flex-row gap-2 items-center">
      <Text className="text-lg font-medium">Set</Text>
      <Separator orientation="vertical" />
      <ScrollView horizontal>
        <View className="flex-row gap-2">
          {options.map(({ set_name }) => (
            <ToggleBadge
              key={set_name}
              label={set_name}
              checked={setNames.includes(set_name)}
              onCheckedChange={() => toggleSet(set_name)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
