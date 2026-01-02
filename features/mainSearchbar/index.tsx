import { SearchBar } from '@/components/ui/search'
import { Portal } from '@rn-primitives/portal'
import React, { RefObject, useRef, useState } from 'react'
import { Keyboard, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SearchInput } from 'react-native-ui-lib'
import { SearchScreen } from './components/SearchScreen'

export function MainSearchBar({ placeholder = 'Search...' }: { placeholder?: string }) {
  // Theme and store hooks
  const [focused, setFocused] = useState(false)

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
      <View className="flex flex-col items-center justify-center px-4 pb-2">
        <SearchBar
          id="searchInput"
          placeholder={placeholder}
          onPress={() => {
            show(inputRef)
          }}
        />
      </View>
      {focused && (
        <Portal name="searchbar" hostName="searchbar">
          <SearchScreen
            style={{ paddingTop: insets.top }}
            focused={focused}
            placeholder={placeholder}
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
