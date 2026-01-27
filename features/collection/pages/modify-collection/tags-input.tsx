import { populateTagOptions, suggestedTagsOptions } from '@/client/collections/tags'
import { useInputColors } from '@/components/ui/input/provider'
import {
  MultiChipInnerInput,
  MultiChipInput,
  MultiChipSuggestions,
} from '@/components/ui/multi-select-input/multi-select-input'
import { useQueryClient } from '@tanstack/react-query'
import { Tags } from 'lucide-react-native'
import { useCallback } from 'react'
import { View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { useCreateNewCollections } from '../../../tcg-card-views/DetailCardView/provider'

const AnimTags = Animated.createAnimatedComponent(Tags)

const ATags = () => {
  const { color } = useInputColors()
  //@ts-ignore
  return <AnimTags size={28} color={color} />
}

type CategoryTag = {
  id: string
  name: string
  category: string
  category_names?: string[]
  category_slugs?: string[]
}

export const CreateCollectionChipInput = () => {
  const qc = useQueryClient()

  const requestedTags = useCreateNewCollections((s) => s.requestedTags)
  const setRequestedTags = useCreateNewCollections((s) => s.setRequestedTags)

  const fetchSuggestions = useCallback(
    (q?: string) => {
      const search = (q ?? '').trim()
      return qc.fetchQuery(suggestedTagsOptions({ search })).then((allTags) => {
        return allTags
      })
    },
    [qc]
  )

  return (
    <MultiChipInput<CategoryTag>
      placeholder={'Tags'}
      fetchSuggestions={fetchSuggestions}
      fetchItems={async (tags) => {
        const allTags = await qc.fetchQuery(populateTagOptions(qc))
        const rest = tags
          .map((t) => {
            const res = allTags.get(t.name.toString().trim().toLowerCase())
            return res
          })
          .map((foundTag, i) => ({
            id: foundTag?.tag_id ?? tags[i].id,
            name: foundTag?.tag_name ?? tags[i].name,
            category: foundTag?.category_slugs?.[0] || 'general',
          }))
        return rest
      }}
      onItemsChange={(items) => {
        setRequestedTags(items)
      }}
      containerStyle={{
        backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
      }}
      leadingAccessory={<ATags />}
    >
      {(props, ref) => (
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
              flex: 1,
              marginHorizontal: 20,
            }}
          >
            <MultiChipInnerInput<CategoryTag> {...props} ref={ref} />
          </View>
          <MultiChipSuggestions<CategoryTag> compare={(a, b) => a.id === b.id} />
        </View>
      )}
    </MultiChipInput>
  )
}
