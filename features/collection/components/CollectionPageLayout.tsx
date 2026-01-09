import { useViewCollectionForUser } from '@/client/collections/query'
import { CollectionListView } from '@/components/collections/list-item'
import { FolderTabsContainer } from '@/components/tabs/FolderTabs'
import { TCard } from '@/constants/types'
import { CollectionItemQueryView, CollectionRow } from '@/lib/store/functions/types'

import { useIsWishlisted } from '@/client/card/wishlist'
import { Tabs } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text'
import { CollectionCardItemEntries } from '@/features/tcg-card-views/DetailCardView/footer/add-to-collections/components'
import { CardListView } from '@/features/tcg-card-views/ListCard'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { SafeAreaView, View } from 'react-native'
import { FlatList, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue } from 'react-native-reanimated'
import { useGetCollection, useGetCollectionItems } from '../hooks'
import { getCollectionIdArgs, useCollectionsPageStore } from '../provider'
import { useCollaspableHeader } from '../ui'
import CollectionBreakdown from './CollectionBreakdown'
import { CollectionInfo } from './CollectionInfo'
import { ScreenHeader } from './Header'
import { CollectionTabList } from './TabList'

type CollectionListItem =
  | { kind: 'collection'; collection: CollectionRow }
  | { kind: 'item'; item: CollectionItemQueryView & TCard }

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

const HeaderSection = () => {
  const { currentPage } = useCollectionsPageStore()
  return currentPage === 'default' ? (
    <CollectionBreakdown
      style={{
        paddingTop: 12,
        paddingBottom: 12,
        marginHorizontal: 12,
      }}
    />
  ) : (
    <CollectionInfo />
  )
}

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<CollectionListItem>)

export const CollectionsPageLayout = () => {
  const { currentPage, setCurrentPage, preferenceState, setIsExpanded, searchQuery } =
    useCollectionsPageStore()
  const measuredHeaderHeight = useSharedValue(0)
  const isDefaultPage = currentPage === 'default'
  const shouldRemeasureHeader = useRef(false)

  const { data: collections, error } = useViewCollectionForUser()

  const { data: collection } = useGetCollection(getCollectionIdArgs(currentPage))
  const { query: collectionItemsQuery } = useGetCollectionItems<CollectionItemQueryView & TCard>(
    getCollectionIdArgs(currentPage),
    { enabled: !isDefaultPage, pageSize: 20 },
    true
  )

  const collectionItems = useMemo(() => {
    return collectionItemsQuery.data?.pages.flat() ?? []
  }, [collectionItemsQuery.data])
  const {
    tabsExpanded,
    headerAnimatedStyle,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    headerContentRef,
  } = useCollaspableHeader(measuredHeaderHeight)

  useEffect(() => setIsExpanded(tabsExpanded), [tabsExpanded])

  const listData = useMemo<CollectionListItem[]>(() => {
    if (isDefaultPage) {
      return (collections ?? []).map((collection) => ({
        kind: 'collection',
        collection,
      }))
    }

    return collectionItems.map((item) => ({
      kind: 'item',
      item,
    }))
  }, [isDefaultPage, collections, collectionItems])

  const renderItem = useCallback(
    ({ item }: { item: CollectionListItem }) => {
      if (item.kind === 'collection') {
        return (
          <CollectionListView
            collection={item.collection}
            onPress={() => {
              const defaultValues = Object.entries(preferenceState.preferences.defaultIds)
              const defaultPage = defaultValues.find(([key, id]) => id && id === item.collection.id)
              if (!defaultPage) {
                preferenceState.updatePreferences({
                  tabs: Array.from(
                    new Set([...(preferenceState.preferences.tabs ?? []), item.collection.id])
                  ),
                })
              }
              setCurrentPage(defaultPage?.[0] ?? item.collection.id)
            }}
          />
        )
      }

      return (
        <CardListView
          card={item.item}
          renderAccessories={() => (
            <CollectionCardItemEntries card={item.item} collection={collection!} isShown editable />
          )}
          // isWishlisted={wishlistedIds?.has(`${card.id}`) ?? false}
        />
      )
    },
    [isDefaultPage, preferenceState, setCurrentPage]
  )

  const keyExtractor = useCallback((item: CollectionListItem) => {
    if (item.kind === 'collection') return `collection-${item.collection.id}`
    return `item-${item.item.collection_item_id ?? item.item.id}`
  }, [])

  useEffect(() => {
    // Reset so the next onLayout updates the shared height once.
    shouldRemeasureHeader.current = true
  }, [currentPage])

  return (
    <SafeAreaView className="flex-1 w-full overflow-hidden h-full" style={{ paddingTop: 8 }}>
      <Tabs
        style={{ flex: 1, display: 'flex', height: '100%' }}
        value={currentPage}
        onValueChange={setCurrentPage}
      >
        <View>
          <ScreenHeader />

          <Animated.View
            ref={headerContentRef}
            key={currentPage}
            style={[headerAnimatedStyle, { overflow: 'hidden' }]}
          >
            <View
              onLayout={(e) => {
                if (shouldRemeasureHeader.current) {
                  measuredHeaderHeight.value = e.nativeEvent.layout.height
                  shouldRemeasureHeader.current = false
                }
              }}
            >
              <CollectionTabList />

              <HeaderSection />
            </View>
          </Animated.View>
        </View>
        {/* {collectionItems && <WishlistDebug ids={collectionItems.map((c) => c.id)} />} */}
        <FolderTabsContainer>
          <GestureDetector gesture={composedGestures}>
            <AnimatedFlatList
              //@ts-ignore
              initialNumToRender={10}
              ref={scrollViewRef}
              scrollEnabled={false}
              style={{ flex: 1 }}
              onLayout={onListLayout}
              onContentSizeChange={onContentSizeChange}
              bounces={false}
              data={listData}
              contentContainerStyle={{
                display: 'flex',
                gap: 18,
                paddingLeft: 12,
                paddingTop: 18,
              }}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
            />
          </GestureDetector>
        </FolderTabsContainer>
      </Tabs>
    </SafeAreaView>
  )
}
