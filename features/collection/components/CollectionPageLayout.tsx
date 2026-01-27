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
import { X } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { SafeAreaView, View } from 'react-native'
import { FlatList, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
} from 'react-native-reanimated'
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
  const { currentPage, showEditView } = useCollectionsPageStore()
  return currentPage === 'default' && !showEditView ? (
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
  const { currentPage, setCurrentPage, preferenceState, setIsExpanded, searchQuery, showEditView } =
    useCollectionsPageStore()
  const isDefaultPage = currentPage === 'default'

  const { data: collections, error } = useViewCollectionForUser()

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
    onHeaderLayout,
  } = useCollaspableHeader(collectionItems.length > 0)

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
              const collection = item.collection
              const isDefaultPage =
                collection?.is_selling || collection?.is_vault || collection?.is_wishlist
              const defaultValues = Object.entries(preferenceState.preferences.defaultIds)
              const defaultPage = defaultValues.find(([key, id]) => id && id === item.collection.id)

              if (!isDefaultPage) {
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
            //@ts-ignore
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

  return (
    <SafeAreaView className="flex-1 w-full overflow-hidden h-full" style={{ paddingTop: 8 }}>
      <Tabs
        style={{ flex: 1, display: 'flex', height: '100%' }}
        value={currentPage}
        onValueChange={setCurrentPage}
      >
        <ScreenHeader />

        <CollectionTabList />

        {!showEditView ? (
          <>
            <Animated.View
              ref={headerContentRef}
              key={`header-${currentPage}`}
              style={[headerAnimatedStyle, { overflow: 'hidden' }]}
            >
              <View onLayout={onHeaderLayout}>
                <HeaderSection />
              </View>
            </Animated.View>
            <Animated.View
              key={currentPage}
              entering={
                direction === 'forward' ? FadeInRight.duration(200) : FadeInLeft.duration(200)
              }
              exiting={
                direction === 'forward' ? FadeOutLeft.duration(180) : FadeOutRight.duration(180)
              }
            >
              <FolderTabsContainer>
                <GestureDetector gesture={composedGestures}>
                  <AnimatedFlatList
                    initialNumToRender={10}
                    //@ts-ignore
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
                    ListEmptyComponent={EmptyColelctionList}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                  />
                </GestureDetector>
              </FolderTabsContainer>
            </Animated.View>
          </>
        ) : currentPage === 'new' ? (
          <NewCollectionView />
        ) : (
          <Animated.View style={{ flex: 1, height: '100%' }}>
            <ModifyCollectionView collection={collection} />
          </Animated.View>
        )}
      </Tabs>
    </SafeAreaView>
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
    <Animated.View style={{ flex: 1, height: '100%' }}>
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
        No items currently in this collection. Start adding some with the "Add +" button.
      </Text>
    </View>
  )
}
