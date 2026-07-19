import { useCardSets } from '@/client/price-charting'
import { useInputColors } from '@/components/ui/input/provider'
import {
  MultiChipInnerInput,
  MultiChipInput,
  MultiChipSuggestions,
} from '@/components/ui/multi-select-input/multi-select-input'
import { Layers } from 'lucide-react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { useFilters } from './providers'

type SetTag = { id: string; name: string }

const AnimatedLayers = Animated.createAnimatedComponent(Layers)

// Leading icon that tracks the input's state color (default / focus / disabled),
// the same animated value that drives the border and floating placeholder —
// via useInputColors(). Must render inside the field's FieldContext (it does,
// both as leadingAccessory and as the chips' renderIcon).
const SetIcon = () => {
  const { color } = useInputColors()
  // @ts-ignore — color is a Reanimated derived value passed as an animated prop
  return <AnimatedLayers size={18} color={color} style={{ marginLeft: 10 }} />
}

/**
 * ITS-91 set multi-select, now a searchable chip input (MultiChipInput). Options
 * come from list_card_sets(), scoped to the selected canonical genre so the list
 * stays bounded; the query text filters that bounded list client-side. The
 * optional `label` matches the ChipRowContainer section label used by GenreFilter
 * so the two sit together cohesively on the Sets tab.
 */
export function SetFilter({ label }: { label?: string }) {
  const { genre, setSetNames } = useFilters()
  const { data: options = [] } = useCardSets(genre)

  // Turns the (disabled) input red when the user taps it without a genre picked.
  // Clears once a genre is selected. Because the field is disabled while genre is
  // null, getColorByState resolves to the `disabled` accent — so we flip that
  // color to danger rather than relying on the error state (which disabled wins over).
  const [pressedNoGenre, setPressedNoGenre] = useState(false)
  useEffect(() => {
    if (genre) setPressedNoGenre(false)
  }, [genre])

  const fetchSuggestions = useCallback(
    (q?: string) => {
      const search = (q ?? '').trim().toLowerCase()
      return Promise.resolve(
        options
          .filter((s) => !search || s.set_name.toLowerCase().includes(search))
          .map<SetTag>((s) => ({ id: s.set_name, name: s.set_name }))
      )
    },
    [options]
  )

  return (
    <View style={{ gap: 4 }}>
      <View style={{ paddingHorizontal: 0 }}>
        <MultiChipInput<SetTag>
          editable={!!genre}
          // While disabled (no genre) the field resolves to the `disabled` accent:
          // a legible neutral normally, flipped to danger once tapped without a genre.
          accentColor={{
            disabled: pressedNoGenre
              ? Colors.rgba(Colors.$textDanger, 1)
              : Colors.rgba(Colors.$textNeutral, 0.7),
          }}
          placeholder={genre ? 'Search sets' : 'Select a genre first'}
          fetchSuggestions={fetchSuggestions}
          renderIcon={() => <SetIcon />}
          onItemsChange={(items) => setSetNames(items.map((i) => i.name))}
          containerStyle={{
            backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
            margin: 0,
          }}
          leadingAccessory={<SetIcon />}
        >
          {(props) => {
            return (
              <View>
                <View style={[{ paddingHorizontal: 12 }]}>
                  <MultiChipInnerInput {...props} />
                </View>
                <MultiChipSuggestions resultsLabel={undefined} compare={props.compare} />
              </View>
            )
          }}
        </MultiChipInput>
        {!genre && (
          // The disabled TextInput swallows touches without emitting press events,
          // so an overlay captures the tap and triggers the red "pick a genre" cue.
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPressedNoGenre(true)} />
        )}
      </View>
    </View>
  )
}
