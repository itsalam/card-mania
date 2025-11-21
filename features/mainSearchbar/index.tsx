import { useIsWishlisted } from '@/client/card/wishlist'
import { useCardSearch, useSuggestionsFixed } from '@/client/price-charting'
import { BlurBackground } from '@/components/Background'
import DraggableThumbContent from '@/components/tcg-card/views/DetailCardView/ui'
import { AppStandaloneHeader } from '@/components/ui/headers'
import { SearchBar } from '@/components/ui/search'
import { Spinner } from '@/components/ui/spinner'
import { Portal } from '@rn-primitives/portal'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native'
import {
  KeyboardAvoidingView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller'
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SearchInput } from 'react-native-ui-lib'
import { FiltersKeys, FiltersProvider, useFiltersStore } from './filters/providers'
import { SearchFilters, SearchFiltersOptions } from './filters/SearchFilters'
import { PreviewCard } from './PreviewItem'

export function MainSearchBar({ placeholder = 'Search...' }: { placeholder?: string }) {
  // Theme and store hooks
  const { progress: keyboardProgress } = useReanimatedKeyboardAnimation()
  const filters = useFiltersStore()
  const filterQuery = useMemo(() => {
    const { min, max } = filters.priceRange
    return {
      ...(filters.itemTypes.length > 0 ? { itemTypes: filters.itemTypes.map((type) => type) } : {}),
      ...(min || max
        ? {
            priceRange: {
              min: min ? min : undefined,
              max: max ? max : undefined,
            },
          }
        : {}),
      ...(filters.sealed ? { sealed: filters.sealed } : {}),
      ...(filters.owned ? { owned: filters.owned } : {}),
      ...(filters.wishlisted ? { wishlisted: filters.wishlisted } : {}),
      ...(filters.unowned ? { unowned: filters.unowned } : {}),
    } as Partial<Record<FiltersKeys, string>> & {
      itemTypes: string[]
      priceRange: { min: number | undefined; max: number | undefined }
    }
  }, [filters])

  // State hooks
  const [focused, setFocused] = useState(false)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [searchText, setSearchText] = useState('')

  // Data fetching hooks
  const { data: autoSuggestions, fetchStatus, ...autoSuggestionsState } = useSuggestionsFixed()
  const {
    data: cardSearch,
    isLoading: isCardSearchLoading,
    ...cardSearchState
  } = useCardSearch({ q: searchText, filters: filterQuery })

  useEffect(() => {
    if (autoSuggestionsState.error) {
      console.error('Auto suggestions error:', autoSuggestionsState.error)
    }
  }, [autoSuggestionsState.error])

  // Refs
  const overlayRef = useRef<View>(null)
  const inputRef = useRef<typeof SearchInput>(null)

  // Animation hooks
  const insets = useSafeAreaInsets()
  const animatedProgress = useSharedValue(0)

  useEffect(() => {
    animatedProgress.value = withTiming(focused ? 1 : 0, { duration: 200 })
  }, [focused])

  // Event handlers
  const hide = () => {
    Keyboard.dismiss()
    setFocused(false)
  }

  const show = () => {
    setFocused(true)
    ;(inputRef as unknown as React.RefObject<View>).current?.focus()
  }

  const debouncedSetSearchText = useMemo(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    return (text: string, delay = 200) => {
      if (t) clearTimeout(t)
      t = setTimeout(() => {
        setSearchText(text)
      }, delay)
    }
  }, [setSearchText])

  // Animated styles
  const inputContainerStyle = useAnimatedStyle(() => {
    return {
      borderTopLeftRadius: focused ? 24 : 0,
      borderTopRightRadius: focused ? 24 : 0,
    }
  }, [focused])

  const overlayStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(1, { duration: 200 }),
    }
  }, [])

  const searchItems = useMemo(
    () => cardSearch?.pages.flatMap((page) => page.results) || autoSuggestions?.results,
    [cardSearch, autoSuggestions]
  )

  const { data: wishlistedIds, error } = useIsWishlisted(
    'card',
    searchItems?.map((item) => item.card.id) || []
  )

  const blurOpacity = useDerivedValue<number>(() => {
    return withTiming(focused ? 0.8 : 0, { duration: 200 })
  }, [focused])

  return (
    <Animated.View className="w-full flex flex-col" ref={overlayRef}>
      <View className="flex flex-col items-center justify-center px-4 pb-2">
        <SearchBar
          id="searchInput"
          placeholder={placeholder}
          onFocus={() => {
            console.log('focus')
            if (!focused) {
              show()
            }
          }}
          onOptionsPress={() => {
            setFiltersExpanded(!filtersExpanded)
            show()
          }}
        />
      </View>
      {focused && (
        <Portal name="searchbar" hostName="searchbar">
          <FiltersProvider filters={filters}>
            <KeyboardAvoidingView
              style={[
                StyleSheet.absoluteFill,
                {
                  overflow: 'visible',
                },
              ]}
              className="z-searchBar"
              behavior={'padding'}
            >
              <BlurBackground opacity={blurOpacity} intensity={20} style={{ flex: 1, overflow: 'visible' }}>
                <Animated.View style={overlayStyle} className="h-full overflow-visible">
                  <AppStandaloneHeader
                    title="Search"
                    onBack={() => {
                      hide()
                    }}
                  />
                  <ScrollView style={{ paddingBottom: insets.bottom }} className="flex-1">
                    <View className="w-full h-full flex flex-col p-4 py-2 gap-2">
                      {!isCardSearchLoading ? (
                        searchItems?.map((item, i) => (
                          <PreviewCard
                            key={item.id}
                            searchItem={item}
                            isWishlisted={wishlistedIds?.has(`${item.card.id}`) ?? false}
                          />
                        )) ?? <Spinner />
                      ) : (
                        <Spinner />
                      )}
                    </View>
                  </ScrollView>
                </Animated.View>
              </BlurBackground>

              <DraggableThumbContent
                style={[
                  inputContainerStyle,
                  {
                    flexGrow: 0,
                  },
                ]}
                toggleLocked={filtersExpanded}
                onLockedChange={setFiltersExpanded}
                mainContent={
                  <>
                    <SearchBar
                      style={{
                        borderWidth: 0,
                      }}
                      id="searchInput"
                      placeholder={placeholder}
                      onChangeText={(text) => {
                        debouncedSetSearchText(text)
                      }}
                      defaultValue={searchText}
                      onFocus={() => {
                        if (!focused) {
                          show()
                        }
                      }}
                      ref={inputRef}
                      onOptionsPress={() => {
                        setFiltersExpanded(!filtersExpanded)
                        show()
                      }}
                    />
                    <SearchFilters focused={focused} />
                  </>
                }
                // className="flex flex-col px-4 py-2 bg-white border-2 border-b-0 border-black/20"
              >
                <SearchFiltersOptions />
              </DraggableThumbContent>
            </KeyboardAvoidingView>
          </FiltersProvider>
        </Portal>
      )}
    </Animated.View>
  )
}
