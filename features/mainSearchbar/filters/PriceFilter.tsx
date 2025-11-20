import { Button } from '@/components/ui/button'

import Slider from '@/components/ui/slider'
import { Text } from '@/components/ui/text'
import React, { useEffect, useMemo, useState } from 'react'
import { TextInput as BaseTextInput, View } from 'react-native'
import Animated, {
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useFilters } from './providers'

const TextInput = Animated.createAnimatedComponent(BaseTextInput)

function PriceFilter({ absMin, absMax }: { absMin: number; absMax: number }) {
  const { priceRange, setPriceRange, toggleDisplayFilter } = useFilters()
  const [startingAbsMax, setStartingAbsMax] = useState(absMax)
  const { min, max } = priceRange
  const minValShared = useSharedValue(min)
  const maxValShared = useSharedValue(max)

  const debouncedSetPriceRange = useMemo(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    return (min = absMin, max = absMax, delay = 50) => {
      if (t) clearTimeout(t)
      t = setTimeout(() => {
        setPriceRange(min, max)
        if (max >= startingAbsMax) {
          setStartingAbsMax(max * 1.66)
        }
      }, delay)
    }
  }, [setPriceRange, startingAbsMax])

  useEffect(() => {
    minValShared.set(min)
    maxValShared.set(max)
  }, [min, max])

  useAnimatedReaction(
    () => [minValShared.value, maxValShared.value], // read on UI thread
    ([min, max], prev) => {
      'worklet'
      if (!prev) return
      const [prevMin, prevMax] = prev
      if (min === prevMin && max === prevMax) return
      // hop to JS and call the debounced setter
      scheduleOnRN(debouncedSetPriceRange, min, max)
    },
    []
  )

  const minValueProps = useAnimatedProps<{
    defaultValue?: string
    text?: string
    placeholder?: string
  }>(() => {
    return minValShared.value !== undefined && minValShared.value >= absMin
      ? {
          defaultValue: `${minValShared.value}`,
          text: `${minValShared.value}`,
        }
      : {
          placeholder: `${absMin}`,
        }
  })

  const maxValueProps = useAnimatedProps<{
    defaultValue?: string
    text?: string
    placeholder?: string
  }>(() => {
    return maxValShared.value !== undefined && maxValShared.value <= startingAbsMax
      ? {
          defaultValue: `${maxValShared.value}`,
          text: `${maxValShared.value}`,
        }
      : {
          placeholder: `${absMax}+`,
        }
  })

  return (
    <Animated.View className="flex flex-row items-center justify-between pb-2">
      <Text className="text-lg font-medium">Price Range</Text>
      <View className="flex-1 flex flex-col gap-2 items-center justify-center">
        <Slider absMin={absMin} absMax={startingAbsMax} min={minValShared} max={maxValShared} />
        <View className="flex-row gap-2 items-center justify-center relative">
          <TextInput
            style={{
              width: 75,
              textAlign: 'center',
            }}
            placeholder="Min"
            keyboardType="numeric"
            animatedProps={minValueProps}
            onChangeText={(text) => {
              const num = Number(text)
              if (isNaN(num)) {
                minValShared.set(undefined)
                return
              }
              minValShared.set(
                Math.min(Math.max(num, absMin), maxValShared.value || startingAbsMax)
              )
            }}
          />
          {<Text> - </Text>}
          <TextInput
            style={{
              width: 75,
              textAlign: 'center',
            }}
            keyboardType="number-pad"
            placeholder="Max"
            animatedProps={maxValueProps}
            onBlur={(e) => {
              e.nativeEvent.target
              const num = e.nativeEvent.target
              if (isNaN(num)) {
                maxValShared.set(undefined)
                return
              }
              maxValShared.set(Math.min(Math.max(num, minValShared.value || 0), startingAbsMax))
            }}
          />
          {(priceRange.min || priceRange.max) && (
            <Button
              style={{
                position: 'absolute',
                right: -8,
                top: 0,
                transform: [{ translateX: '100%' }],
              }}
              variant="ghost"
              onPress={() => toggleDisplayFilter('priceRange')}
            >
              <Text className="text-base font-medium text-blue-600">Clear</Text>
            </Button>
          )}
        </View>
      </View>
    </Animated.View>
  )
}

export default PriceFilter
