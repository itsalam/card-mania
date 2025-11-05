import { useSuggestionsFixed } from '@/client/price-charting'
import { Input, InputField } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { useUserStore } from '@/lib/store/useUserStore'
import { BlurView } from 'expo-blur'
import { Search, SlidersHorizontal } from 'lucide-react-native'
import React, { useRef, useState } from 'react'
import { Animated, Platform, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Card } from '../ui/card'
import { Spinner } from '../ui/spinner'

const AnimatedBlur = Animated.createAnimatedComponent(BlurView)

export function SearchBar({ placeholder = 'Search...' }: { placeholder?: string }) {
  const { data: autoSuggestions, ...autoSuggestionsState } = useSuggestionsFixed()
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<React.ComponentRef<typeof InputField>>(null)
  const { top } = useSafeAreaInsets()

  // drive opacity (simple + fast). You can also animate `intensity` similarly.
  const opacity = useRef(new Animated.Value(0)).current

  const show = () => {
    setFocused(true)
    Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }).start(() =>
      inputRef.current?.focus()
    )
  }
  const hide = () => {
    Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setFocused(false)
    })
  }

  const { signOut } = useUserStore()
  return (
    <View className="w-full p-4 flex flex-col py-2 overflow-visible">
      <View className="z-searchBar relative">
        <Input
          className="flex rounded-full items-center bg-background-100 px-4 z-searchBar"
          size="xl"
        >
          <Search size={20} />
          <InputField
            ref={inputRef}
            className="flex-1"
            placeholder={placeholder}
            onFocus={show}
            onBlur={hide}
          />
          <SlidersHorizontal
            size={16}
            onPress={() => {
              console.log('signOut')
              signOut()
            }}
          />
        </Input>
        {focused && <View className="w-full flex flex-col absolute -bottom-20 top-[120%]">
          <Card variant="outline" className="w-full flex flex-col bg-background-100">
            {autoSuggestions?.results?.slice(0, 10).map((suggestion) => (
              <View key={suggestion.id} className="w-full flex flex-row">
                <Text>{suggestion.name}</Text>
              </View>
            )) ?? <Spinner/>}
          </Card>
        </View>}
      </View>

      {focused && (
        <>
          <AnimatedBlur
            className="z-searchBarOverlay absolute top-0 left-0 right-0 bottom-0 w-[150vw] h-[150vh]"
            tint={Platform.OS === 'ios' ? 'dark' : 'regular'}
            intensity={10} // bump this up if you want a stronger blur
            experimentalBlurMethod="dimezisBlurView" // better Android quality when available
          >
            <Pressable
              onPress={() => {
                inputRef.current?.blur()
                hide()
              }}
              className="w-full h-full"
            />
          </AnimatedBlur>

          {/* Tap to dismiss area on top of blur, but under the search bar */}
        </>
      )}
    </View>
  )
}
;``
