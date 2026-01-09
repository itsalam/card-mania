import { useCardSearch, useSuggestionsFixed } from '@/client/price-charting'
import { BlurGradientBackground } from '@/components/Background'
import { AppStandaloneHeader } from '@/components/ui/headers'
import { SearchBar } from '@/components/ui/search'
import { Spinner } from '@/components/ui/spinner'
import DraggableThumbContent from '@/features/tcg-card-views/DetailCardView/ui'
import { ItemListViewProps } from '@/features/tcg-card-views/ListCard'
import React, { RefObject, useEffect, useMemo, useState } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { FlatList } from 'react-native-gesture-handler'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SearchPreviewCard } from '../PreviewItem'
import { FiltersKeys, FiltersProvider, useFiltersStore } from './filters/providers'
import { SearchFiltersOptions } from './filters/SearchFilters'

export type SearchScreenProps = {
  focused?: boolean
  placeholder?: string
  inputRef?: RefObject<View>
  show?: (ref?: RefObject<View>) => void
  hide?: () => void
  style?: StyleProp<ViewStyle>
  title?: string
  itemAccessories?: ItemListViewProps['renderAccessories']
}

export function SearchScreen({
  focused = true,
  placeholder,
  show,
  hide,
  inputRef,
  style,
  title = 'Search',
  itemAccessories,
}: SearchScreenProps) {
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
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [bottomPadding, setBottomPadding] = useState(0)

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

  // Animation hooks
  const insets = useSafeAreaInsets()
  const animatedProgress = useSharedValue(0)

  useEffect(() => {
    animatedProgress.value = withTiming(focused ? 1 : 0, { duration: 200 })
  }, [focused])

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

  const searchItems = useMemo(
    () => cardSearch?.pages.flatMap((page) => page.results) || autoSuggestions?.results,
    [cardSearch, autoSuggestions]
  )

  const blurOpacity = useDerivedValue<number>(() => {
    return withTiming(focused ? 0.8 : 0, { duration: 200 })
  }, [focused])

  const overlayStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(1, { duration: 200 }),
    }
  }, [])

  return (
    <FiltersProvider filters={filters}>
      <KeyboardAvoidingView
        style={[
          StyleSheet.absoluteFill,
          {
            overflow: 'visible',
          },
        ]}
        className="z-searchBar"
        // behavior={'translate-with-padding'}
      >
        <BlurGradientBackground
          opacity={blurOpacity}
          style={{ flex: 1, overflow: 'visible', paddingBottom: bottomPadding }}
        >
          <Animated.View
            style={[overlayStyle, style, { paddingBottom: insets.bottom }]}
            className="h-full overflow-visible"
          >
            <AppStandaloneHeader
              title={title}
              onBack={() => {
                hide?.()
              }}
            />
            <FlatList
              className="flex-1"
              data={!isCardSearchLoading ? searchItems : []}
              ListEmptyComponent={Spinner}
              renderItem={({ item }) => (
                <SearchPreviewCard
                  key={item.id}
                  searchItem={item}
                  renderAccessories={itemAccessories}
                />
              )}
              contentContainerStyle={{
                display: 'flex',
                gap: 18,
                paddingHorizontal: 12,
                paddingTop: 18,
              }}
            />
          </Animated.View>
        </BlurGradientBackground>

        <DraggableThumbContent
          onMainContentMeasure={(layout) => {
            if (layout) setBottomPadding(layout.height)
          }}
          isKeyboardAccessory
          containerStyle={[
            inputContainerStyle,
            {
              flexGrow: 0,
            },
          ]}
          toggleLocked={filtersExpanded}
          onLockedChange={setFiltersExpanded}
          mainContent={
            <View
              style={{
                paddingBottom: 20,
                width: '100%',
              }}
            >
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
                    show?.(inputRef)
                  }
                }}
                ref={inputRef}
                onOptionsPress={() => {
                  setFiltersExpanded(!filtersExpanded)
                  show?.(inputRef)
                }}
              />
            </View>
          }
          // className="flex flex-col px-4 py-2 bg-white border-2 border-b-0 border-black/20"
        >
          <SearchFiltersOptions />
        </DraggableThumbContent>
      </KeyboardAvoidingView>
    </FiltersProvider>
  )
}
