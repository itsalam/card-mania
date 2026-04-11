import { useSuggestionQuery } from '@/client/price-charting'
import { SearchBar } from '@/components/ui/search'
import { Portal } from '@rn-primitives/portal'
import React, { RefObject, useRef, useState } from 'react'
import { Keyboard, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SearchInput } from 'react-native-ui-lib'
import { SearchScreen } from './components/SearchScreen'

export function MainSearchBar({ placeholder }: { placeholder?: string }) {
  // Theme and store hooks
  const [focused, setFocused] = useState(false)
  const activeQuery = useSuggestionQuery()
  const effectivePlaceholder = placeholder ?? (activeQuery ? `${activeQuery}` : 'Search...')

  const inputRef = useRef<typeof SearchInput>(null)

  // Event handlers
  const hide = () => {
    Keyboard.dismiss()
    setFocused(false)
  }

  const show = (inputRef?: RefObject<View>) => {
    setFocused(true)
    ;(inputRef as unknown as RefObject<View>).current?.focus()
  }

  const insets = useSafeAreaInsets()

  return (
    <Animated.View className="w-full flex flex-col">
      <View
        className="flex flex-col items-center justify-center px-4"
        style={{ paddingVertical: 4 }}
      >
        <SearchBar
          id="searchInput"
          placeholder={effectivePlaceholder}
          onPress={() => {
            show(inputRef)
          }}
        />
      </View>
      {focused && (
        <Portal name="searchbar" hostName="searchbar">
          <SearchScreen
            autofocus
            style={{ paddingTop: insets.top }}
            focused={focused}
            placeholder={effectivePlaceholder}
            title={'Search'}
            show={show}
            hide={hide}
            inputRef={inputRef}
          />
        </Portal>
      )}
    </Animated.View>
  )
}
