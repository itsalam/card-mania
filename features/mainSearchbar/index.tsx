import { useIsWishlisted } from '@/client/card/wishlist'
import { useCardSearch, useSuggestionsFixed } from '@/client/price-charting'
import { Button } from '@/components/ui/button'
import { AppStandaloneHeader } from '@/components/ui/headers'
import { InnerInputField, Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { Portal } from '@rn-primitives/portal'
import { BlurView } from 'expo-blur'
import { Search, SlidersHorizontal } from 'lucide-react-native'
import React, { ComponentProps, forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import {
  KeyboardAvoidingView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useOverlay } from '../overlay/provider'
import { FiltersKeys, FiltersProvider, useFiltersStore } from './filters/providers'
import { SearchFilters, SearchFiltersOptions } from './filters/SearchFilters'
import { PreviewCard } from './PreviewItem'

const ABlurView = Animated.createAnimatedComponent(BlurView)
const AGestureHandlerRootView = Animated.createAnimatedComponent(GestureHandlerRootView)

const SearchContainer = ({ children, className, ...props }: ComponentProps<typeof Input>) => {
  return (
    <Input
      className={cn(
        'flex gap-1 rounded-full h-14 items-center px-4 z-searchBar border-none bg-transparent',
        className
      )}
      size="xl"
      {...props}
    >
      <Search size={22} />
      {children}
    </Input>
  )
}

const SearchInput = forwardRef<
  React.ComponentRef<typeof InnerInputField>,
  ComponentProps<typeof InnerInputField>
>((props, ref) => {
  return <InnerInputField {...props} ref={ref} />
})

export function SearchBar({ placeholder = 'Search...' }: { placeholder?: string }) {
  // Theme and store hooks
  const { progress: keyboardProgress } = useReanimatedKeyboardAnimation()
  const filters = useFiltersStore()
  const { hiddenId } = useOverlay()
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
      paddingBottom: interpolate(keyboardProgress.value, [0, 1], [insets.bottom, 0]),
    }
  }, [focused])

  const overlayStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(hiddenId ? 0 : 1, { duration: 200 }),
    }
  }, [hiddenId])

  const searchItems = useMemo(
    () => cardSearch?.pages.flatMap((page) => page.results) || autoSuggestions?.results,
    [cardSearch, autoSuggestions]
  )

  const { data: wishlistedIds, error } = useIsWishlisted(
    'card',
    searchItems?.map((item) => item.card.id) || []
  )

  return (
    <Animated.View className="w-full flex flex-col" ref={overlayRef}>
      <View className="flex flex-col items-center justify-center px-4 pb-2">
        <SearchContainer className="w-full">
          <SearchInput
            id="searchInput"
            type="text"
            className="flex-1"
            placeholder={placeholder}
            onFocus={() => {
              if (!focused) {
                show()
              }
            }}
          />
          <Button
            variant="ghost"
            className="pr-2 pl-4"
            onPress={() => {
              setFiltersExpanded(!filtersExpanded)
              show()
            }}
          >
            <SlidersHorizontal size={16} />
          </Button>
        </SearchContainer>
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
              className="z-searchBar bg-secondary-200/80"
              behavior={'padding'}
            >
              <BlurView intensity={20} tint="systemMaterial" className="flex-1 overflow-visible">
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
              </BlurView>

              <AGestureHandlerRootView
                style={[
                  inputContainerStyle,
                  {
                    flexGrow: 0,
                  },
                ]}
                className="flex flex-col px-4 py-2 bg-white border-2 border-b-0 border-black/20"
              >
                <SearchContainer className={'px-4 border-0 bg-transparent border-b'}>
                  <SearchInput
                    id="searchInput"
                    type="text"
                    className="flex-1"
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
                  />
                  <Button
                    variant="ghost"
                    className="pr-2 pl-4"
                    onPress={() => {
                      setFiltersExpanded(!filtersExpanded)
                      show()
                    }}
                  >
                    <SlidersHorizontal size={16} />
                  </Button>
                </SearchContainer>
                <SearchFilters focused={focused} />
                <SearchFiltersOptions expanded={filtersExpanded} focused={focused} />
              </AGestureHandlerRootView>
            </KeyboardAvoidingView>
          </FiltersProvider>
        </Portal>
      )}
    </Animated.View>
  )
}
