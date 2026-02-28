import { useViewCollectionForUser } from '@/client/collections/query'
import { CollectionListView } from '@/components/collections/list-item'
import { FolderTabsContainer } from '@/components/tabs/FolderTabs'
import { TCard } from '@/constants/types'
import { CollectionItemQueryView, CollectionRow } from '@/lib/store/functions/types'

import { useIsWishlisted } from '@/client/card/wishlist'
import { CollectionLike } from '@/client/collections/types'
import { Tabs } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text'
import { CollectionCardItemEntries } from '@/features/tcg-card-views/DetailCardView/footer/pages/add-to-collections/components'
import { CardListView } from '@/features/tcg-card-views/ListCard'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { X } from 'lucide-react-native'
import React, { useCallback, useMemo, useRef } from 'react'
import { View } from 'react-native'
import { FlatList, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
import { shallow } from 'zustand/shallow'
import { useGetCollection, useGetCollectionItems } from '../hooks'
import { ModifyCollectionView } from '../pages/modify-collection'
import { defaultPages, getCollectionIdArgs, useCollectionsPageStore } from '../provider'
import { useCollaspableHeader } from '../ui'
import CollectionBreakdown from './CollectionBreakdown'
import { CollectionInfo } from './CollectionInfo'
import { ScreenHeader } from './Header'
import { CollectionTabList } from './TabList'

export function WishlistDebug({ ids }: { ids: string[] }) {
  const { data, isFetching, fetchStatus, ...rest } = useIsWishlisted('card', ids)

  return (
    <View style={{ padding: 8 }}>
      <Text>fetchStatus: {fetchStatus}</Text>
      <Text>isFetching: {isFetching ? 'yes' : 'no'}</Text>
      <Text>cached: {[...(data ?? new Set())].join(',')}</Text>
    </View>
  )
}

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<CollectionListItem>)

export const CollectionsPageLayout = () => {
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { currentPage, setCurrentPage, preferenceState, setShowEditView, showEditView } =
    useCollectionsPageStore()

  const orderedPages = useMemo(() => {
    const customTabs = preferenceState.preferences.tabs ?? []
    const merged = [...defaultPages]
    for (const tab of customTabs) {
      if (!merged.includes(tab as any)) merged.push(tab as any)
    }
    return merged
  }, [preferenceState.preferences.tabs])

  const prevPageIndexRef = useRef(orderedPages.indexOf(currentPage as any) ?? 0)
  const direction = useMemo(() => {
    const nextIndex = orderedPages.indexOf(currentPage as any)
    const prevIndex = prevPageIndexRef.current
    if (nextIndex >= 0) {
      const dir = nextIndex >= prevIndex ? 'forward' : 'backward'
      prevPageIndexRef.current = nextIndex
      return dir
    }
    return 'forward'
  }, [currentPage, orderedPages])

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 w-full overflow-hidden">
      <Tabs
        style={{ flex: 1, display: 'flex', height: '100%' }}
        value={currentPage}
        onValueChange={setCurrentPage}
      >
        <ScreenHeader />

        <CollectionTabList />

        {currentPage === 'default' ? (
          <DefaultCollectionView direction={direction} />
        ) : !showEditView ? (
          <DetailCollectionView direction={direction} />
        ) : currentPage === 'new' ? (
          <NewCollectionView />
        ) : (
          <Animated.View style={{ flex: 1, height: '100%' }}>
            <ModifyCollectionView
              //@ts-ignore
              collection={collection}
              onSubmit={() => setShowEditView(false)}
            />
          </Animated.View>
        )}
      </Tabs>
    </View>
  )
}

const DefaultCollectionView = ({ direction }: { direction: 'forward' | 'backward' }) => {
  const { currentPage, setCurrentPage, preferenceState } = useCollectionsPageStore()

  const {
    headerAnimatedStyle,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
  } = useCollaspableHeader()

  const {
    data: collections,
    error,
    isLoading: isLoadingCollections,
  } = useViewCollectionForUser(true)

  const listData = useMemo<CollectionRow[]>(() => {
    if (isLoadingCollections) return Array(7).fill({ kind: 'collection' })
    return collections ?? []
  }, [collections, isLoadingCollections])

  const renderItem = useCallback(
    ({ item }: { item: CollectionRow }) => {
      return (
        <CollectionListView
          collection={item}
          onPress={() => {
            const isDefaultPage = item?.is_selling || item?.is_vault || item?.is_wishlist
            const defaultValues = Object.entries(preferenceState.preferences.defaultIds)
            const defaultPage = defaultValues.find(([key, id]) => id && id === item.id)

            if (!isDefaultPage) {
              preferenceState.updatePreferences({
                tabs: Array.from(new Set([...(preferenceState.preferences.tabs ?? []), item.id])),
              })
            }
            setCurrentPage(defaultPage?.[0] ?? item.id)
          }}
          isLoading={isLoadingCollections}
        />
      )
    },
    [preferenceState, setCurrentPage, isLoadingCollections]
  )

  const keyExtractor = useCallback((item: CollectionRow, index: number) => {
    return `collection-${item?.id ?? `skeleton-${index}`}`
  }, [])

  return (
    <GestureDetector gesture={composedGestures}>
      <Animated.View
        key={currentPage}
        entering={direction === 'forward' ? FadeInRight.duration(200) : FadeInLeft.duration(200)}
        exiting={direction === 'forward' ? FadeOutLeft.duration(180) : FadeOutRight.duration(180)}
      >
        <Animated.View
          key={`header-${currentPage}`}
          style={[headerAnimatedStyle, { overflow: 'hidden' }]}
        >
          <View onLayout={onHeaderLayout}>
            <CollectionBreakdown
              style={{
                paddingTop: 12,
                marginBottom: 40,
                marginHorizontal: 12,
              }}
            />
          </View>
        </Animated.View>
        <Animated.View>
          <FolderTabsContainer>
            <AnimatedFlatList
              initialNumToRender={10}
              //@ts-ignore
              ref={scrollViewRef}
              onLayout={onListLayout}
              onContentSizeChange={onContentSizeChange}
              scrollEnabled={false}
              style={{ flex: 1 }}
              bounces={false}
              data={listData}
              contentContainerStyle={{
                display: 'flex',
                gap: 18,
                paddingLeft: 12,
                paddingTop: 18,
              }}
              ListEmptyComponent={EmptyColelctionList}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
            />
          </FolderTabsContainer>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
}

const DetailCollectionView = ({ direction }: { direction: 'forward' | 'backward' }) => {
  const {
    currentPage,
    setCurrentPage,
    preferenceState,
    setIsExpanded,
    setShowEditView,
    showEditView,
  } = useCollectionsPageStore()

  const { data: collection } = useGetCollection(getCollectionIdArgs(currentPage))
  const { query: collectionItemsQuery } = useGetCollectionItems<CollectionItemQueryView & TCard>(
    getCollectionIdArgs(currentPage),
    { pageSize: 20 },
    true
  )
  const { isLoading: isLoadingItems } = collectionItemsQuery
  const collectionItems = useMemo(() => {
    return collectionItemsQuery.data?.pages.flat() ?? []
  }, [collectionItemsQuery.data])

  const listData = useMemo<(CollectionItemQueryView & TCard)[]>(() => {
    if (isLoadingItems) {
      return Array(4).fill({ kind: 'skeleton' })
    }

    return collectionItems
  }, [, , collectionItems, , isLoadingItems])

  const {
    tabsExpanded,
    headerAnimatedStyle,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
  } = useCollaspableHeader(collectionItems.length > 0, [currentPage, collection?.id])

  const renderItem = useCallback(
    ({ item }: { item: CollectionItemQueryView & TCard }) => {
      return (
        <CardListView
          card={item}
          renderAccessories={({ isLoading }) => (
            <CollectionCardItemEntries
              isLoading={isLoading}
              card={item}
              //@ts-ignore
              collection={collection!}
              isShown
              editable
            />
          )}
          isLoading={isLoadingItems}
        />
      )
    },
    [preferenceState, setCurrentPage, isLoadingItems]
  )

  const keyExtractor = useCallback((item: CollectionItemQueryView & TCard, index: number) => {
    return `item-${item?.collection_item_id ?? item?.id ?? `skeleton-${index}`}`
  }, [])

  return (
    <GestureDetector gesture={composedGestures}>
      <Animated.ScrollView
        key={currentPage}
        ref={scrollViewRef}
        onLayout={onListLayout}
        onContentSizeChange={onContentSizeChange}
        entering={direction === 'forward' ? FadeInRight.duration(200) : FadeInLeft.duration(200)}
        exiting={direction === 'forward' ? FadeOutLeft.duration(180) : FadeOutRight.duration(180)}
        style={{
          paddingVertical: 16,
        }}
      >
        <Animated.View
          key={`header-${currentPage}`}
          style={[
            headerAnimatedStyle,
            {
              overflowY: 'hidden',
            },
          ]}
        >
          <View onLayout={onHeaderLayout}>
            <CollectionInfo />
          </View>
        </Animated.View>
        <Animated.View
          style={{
            borderTopWidth: 2,
            borderColor: Colors.$outlineNeutral,
          }}
        >
          <FolderTabsContainer>
            <AnimatedFlatList
              initialNumToRender={10}
              //@ts-ignore

              scrollEnabled={false}
              style={{ flex: 1 }}
              bounces={false}
              data={listData}
              contentContainerStyle={{
                display: 'flex',
                gap: 18,
                paddingLeft: 12,
                paddingTop: 18,
              }}
              ListEmptyComponent={EmptyColelctionList}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
            />
          </FolderTabsContainer>
        </Animated.View>
      </Animated.ScrollView>
    </GestureDetector>
  )
}

const NewCollectionView = () => {
  const { setNewCollectionInfo, preferenceState, setCurrentPage } = useCollectionsPageStore()
  const lastRef = useRef<Partial<CollectionLike> | null>(null)

  const handleChange = useCallback(
    (ci: CollectionLike) => {
      const next = {
        name: ci.name,
        description: ci.description,
        visibility: ci.visibility,
        tags_cache: ci.tags_cache,
        // any other fields you track
      }
      if (lastRef.current && shallow(lastRef.current, next)) return
      lastRef.current = next
      setNewCollectionInfo(next)
    },
    [setNewCollectionInfo]
  )

  return (
    <Animated.View style={{ flex: 1, height: '100%', paddingBottom: 16 }}>
      <ModifyCollectionView
        onChange={(ci) => handleChange(ci)}
        onSubmit={(res) => {
          preferenceState
            .updatePreferences({
              tabs: Array.from(
                new Set([...(preferenceState.preferences.tabs ?? []), res.collection.id])
              ),
            })
            .then(() => {
              setCurrentPage(res.collection.id)
            })
        }}
      />
    </Animated.View>
  )
}

const EmptyColelctionList = () => {
  return (
    <View
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        width: '80%',
        alignSelf: 'center',
        paddingVertical: 12,
        gap: 12,
      }}
    >
      <X size={32} color={Colors.$iconDisabled} />
      <Text style={{ color: Colors.$iconDisabled, textAlign: 'center' }}>
        {'No items currently in this collection. Start adding some with the "Add +" button.'}
      </Text>
    </View>
  )
}
