import { reportSearchRenderMs, useCardSearch, useSuggestionsFixed } from '@/client/price-charting'
import { BlurGradientBackground, ShoulderCutoutDescriptor } from '@/components/Background'
import DraggableFooter from '@/components/DraggableFooter'
import { AppStandaloneHeader } from '@/components/ui/headers'
import { SearchBar } from '@/components/ui/search'
import { Spinner } from '@/components/ui/spinner'
import { ItemListViewProps } from '@/features/tcg-card-views/types'
import { useRefresh } from '@/lib/hooks/useRefresh'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import React, { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshControl, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
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
  /** Header rendered inside the gradient background — supply when the caller owns the header. */
  header?: React.ReactNode
  /** Pre-computed shoulder cutout descriptor from the caller — drives the background void. */
  shoulderCutout?: ShoulderCutoutDescriptor
  /** Set true when no header should render at all */
  hideHeader?: boolean
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
  header,
  shoulderCutout,
  hideHeader = false,
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
    refetch: refetchSearch,
    ...cardSearchState
  } = useCardSearch({ q: searchText, filters: filterQuery })
  const { refreshing, onRefresh } = useRefresh([refetchSearch])

  useEffect(() => {
    if (autoSuggestionsState.error) {
      console.error('Auto suggestions error:', autoSuggestionsState.error)
    }
  }, [autoSuggestionsState.error])

  // Measure time from first network fetch to data arrival and persist it so
  // _providers.tsx can decide whether to prefetch on the next app start.
  const fetchStartRef = useRef<number | null>(null)
  const hasMeasuredRef = useRef(false)
  useEffect(() => {
    if (fetchStatus === 'fetching' && fetchStartRef.current === null) {
      fetchStartRef.current = Date.now()
    }
  }, [fetchStatus])
  useEffect(() => {
    if (autoSuggestions && fetchStartRef.current !== null && !hasMeasuredRef.current) {
      hasMeasuredRef.current = true
      reportSearchRenderMs(Date.now() - fetchStartRef.current)
    }
  }, [autoSuggestions])

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
    return withTiming(focused ? 0 : 0, { duration: 200 })
  }, [focused])

  const overlayStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(1, { duration: 200 }),
    }
  }, [])

  const TOP_FADE_H = 24
  const bottomFadeH = Math.max(Math.min(bottomPadding || 80, 80) + insets.bottom, 40)

  const scrollInfoRef = useRef({ y: 0, contentH: 0, frameH: 0 })
  const [edgeState, setEdgeState] = useState({ top: true, bottom: false })

  const checkEdges = useCallback(() => {
    const { y, contentH, frameH } = scrollInfoRef.current
    const atTop = y <= 8
    const atBottom = contentH > 0 && frameH > 0 && contentH - frameH - y <= 8
    setEdgeState((prev) => {
      if (prev.top === atTop && prev.bottom === atBottom) return prev
      return { top: atTop, bottom: atBottom }
    })
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
          // backgroundOpacity={0.8}
          opacity={blurOpacity}
          style={{ flex: 1, overflow: 'visible', paddingBottom: bottomPadding }}
          shoulderCutout={shoulderCutout}
        >
          <Animated.View
            style={[overlayStyle, style, { paddingBottom: insets.bottom }]}
            className="h-full overflow-visible"
          >
            {/* zIndex:1 ensures the header (and its absolutely-positioned pill SVG)
                always renders above FlatList items regardless of JSX order. */}
            {!hideHeader && (
              <View style={{ zIndex: 1 }}>
                {header ?? (
                  <AppStandaloneHeader title={title} onBack={hide ? () => hide() : undefined} />
                )}
              </View>
            )}
            {/* MaskedView clips scroll content (overflow:hidden equivalent) and
                fades the list at top/bottom via RN Animated.Value opacity on the
                gradient views inside the mask element. RN's native-driver timing
                goes through Core Animation / Android RenderThread, which MaskedView's
                compositing pass DOES observe — unlike Reanimated's UI-thread writes. */}
            {/* Three non-overlapping absolute zones — no SRC_OVER compositing
                between them, so alpha is never accidentally cancelled out.
                Content is offset by the same pixel amounts via contentContainerStyle
                padding so items start/end outside the fade zones at rest. */}
            <MaskedView
              style={{ flex: 1 }}
              maskElement={
                <View style={{ height: '100%', width: '100%' }}>
                  {/* Solid body — content visible everywhere except the fade zones */}
                  <View
                    style={{
                      position: 'absolute',
                      top: edgeState.top ? 0 : TOP_FADE_H,
                      bottom: edgeState.bottom ? 0 : bottomFadeH,
                      left: 0,
                      right: 0,
                      backgroundColor: 'black',
                    }}
                  />
                  {/* Top fade — mounted only when scrolled away from the top edge.
                      Mount/unmount causes a React re-render that MaskedView observes;
                      animated opacity inside maskElement is not captured by the compositor. */}
                  {!edgeState.top && (
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)', 'black']}
                      locations={[0, 0.3, 0.65, 1]}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: TOP_FADE_H,
                      }}
                    />
                  )}
                  {/* Bottom fade — mounted only when more content exists below */}
                  {!edgeState.bottom && (
                    <LinearGradient
                      colors={['black', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.4)', 'transparent']}
                      locations={[0, 0.35, 0.7, 1]}
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: bottomFadeH,
                      }}
                    />
                  )}
                </View>
              }
            >
              <FlatList
                className="flex-1"
                data={!isCardSearchLoading ? searchItems : []}
                ListEmptyComponent={Spinner}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
                  paddingLeft: 12,
                  paddingBottom: bottomFadeH,
                }}
                onScroll={(e) => {
                  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
                  scrollInfoRef.current = {
                    y: contentOffset.y,
                    contentH: contentSize.height,
                    frameH: layoutMeasurement.height,
                  }
                  checkEdges()
                }}
                onContentSizeChange={(_, h) => {
                  scrollInfoRef.current.contentH = h
                  checkEdges()
                }}
                onLayout={(e) => {
                  scrollInfoRef.current.frameH = e.nativeEvent.layout.height
                  checkEdges()
                }}
                scrollEventThrottle={16}
              />
            </MaskedView>
          </Animated.View>
        </BlurGradientBackground>

        <DraggableFooter
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
                autoFocus
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
        </DraggableFooter>
      </KeyboardAvoidingView>
    </FiltersProvider>
  )
}
