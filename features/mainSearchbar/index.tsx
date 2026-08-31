import { useSuggestionQuery } from '@/client/price-charting'
import {
  collapsedSearchIconButtonStyle,
  ExpandableSearchBar,
  SearchBar,
} from '@/components/ui/search'
import { Portal } from '@rn-primitives/portal'
import React, { RefObject, useRef, useState } from 'react'
import { Keyboard, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SearchInput } from 'react-native-ui-lib'
import { SearchScreen } from './components/SearchScreen'

export function MainSearchBar({
  placeholder,
  collapsed = false,
}: {
  placeholder?: string
  /** Renders as a collapsed icon-only button (matching Collection's header search) instead of a
   *  full-width bar — for layouts where the search bar shares a row with other content (e.g.
   *  Home's logo/welcome row) rather than owning a full row of its own. Tapping it opens the same
   *  full-screen SearchScreen as the full-width variant — this only changes the trigger's visual
   *  footprint, not the search UX itself. */
  collapsed?: boolean
}) {
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
    <Animated.View className={collapsed ? 'flex flex-col' : 'w-full flex flex-col'}>
      {collapsed ? (
        <ExpandableSearchBar
          expanded={false}
          variant={'ghost'}
          // "sm" matches collapsedSearchIconButtonStyle's own explicit height (see
          // components/ui/search/index.tsx) — without it this defaults to size="search" (64px),
          // producing an oversized, mis-shapen button. hideSideButton drops the options/filter
          // icon SearchBar renders by default, which has no room in this collapsed width.
          size="sm"
          hideSideButton
          style={collapsedSearchIconButtonStyle}
          onLeftIconPress={() => show(inputRef)}
        />
      ) : (
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
      )}
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
