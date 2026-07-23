import { useViewCollectionForUser } from '@/client/collections/query'
import { CollectionsAvatar } from '@/components/collections/avatar'
import { FolderTabsContainer } from '@/components/tabs/FolderTabs'
import { TCard } from '@/constants/types'
import { CollectionItemQueryView, CollectionRow } from '@/lib/store/functions/types'

import { useIsWishlisted } from '@/client/card/wishlist'
import { CollectionLike } from '@/client/collections/types'
import { THUMBNAIL_HEIGHT } from '@/components/tcg-card/consts'
import { Tabs } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text/base-text'
import { VISIBILITY_OPTIONS } from '@/features/tcg-card-views/DetailCardView/components/ui'
import { CollectionCardItemEntries } from '@/features/tcg-card-views/DetailCardView/pages/add-to-collections/components'
import { CardListView } from '@/features/tcg-card-views/ListCard'
import { useRefresh } from '@/lib/hooks/useRefresh'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { ChevronDown, X } from 'lucide-react-native'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, RefreshControl, TouchableOpacity, View } from 'react-native'
import { FlatList, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { shallow } from 'zustand/shallow'
import {
  useDefaultCollectionIds,
  useGetCollection,
  useGetCollectionCountInfo,
  useGetCollectionItems,
} from '../hooks'
import { ModifyCollectionView } from '../pages/modify-collection'
import { defaultPages, getCollectionIdArgs, useCollectionsPageStore } from '../provider'
import { useCollaspableHeader } from '../ui'
import CollectionBreakdown from './CollectionBreakdown'
import { CollectionGroupContainer } from './CollectionGroupContainer'
import { CollectionInfo } from './CollectionInfo'
import { ScreenHeader } from './Header'
import { CollectionTabList } from './TabList'

type ListEntry =
  | {
      type: 'group'
      collectionRef: string | null
      collectionName: string
      items: (CollectionItemQueryView & TCard)[]
    }
  | { type: 'item'; data: CollectionItemQueryView & TCard }

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

const AnimatedCollectionItemList = Animated.createAnimatedComponent(FlatList<ListEntry>)

export const CollectionsPageLayout = () => {
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { currentPage, setCurrentPage, preferenceState, setShowEditView, showEditView } =
    useCollectionsPageStore()

  const { data: collection } = useGetCollection(getCollectionIdArgs(currentPage))

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

// ─── Card-style item for the DefaultCollectionView list ─────────────────────

function CollectionCard({
  collection,
  onPress,
  isLoading,
}: {
  collection: CollectionRow
  onPress: () => void
  isLoading?: boolean
}) {
  const { data: count } = useGetCollectionCountInfo(
    isLoading || !collection?.id ? {} : { collectionId: collection.id }
  )
  const visibilityInfo = VISIBILITY_OPTIONS.find((v) => v.key === collection?.visibility)
  const VisibilityIcon = visibilityInfo?.icon

  if (isLoading) {
    return (
      <View
        style={{
          borderRadius: BorderRadiuses.br50,
          borderWidth: 2,
          borderColor: Colors.$outlineNeutral,
          backgroundColor: Colors.$backgroundElevatedLight,
          padding: 14,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'flex-start',
        }}
      />
    )
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View
        style={{
          borderRadius: BorderRadiuses.br50,
          borderWidth: 2,
          borderColor: Colors.$outlineNeutral,
          backgroundColor: Colors.$backgroundElevatedLight,
          padding: 14,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <CollectionsAvatar iconImageSrc={collection.cover_image_url ?? undefined} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="h4">{collection.name}</Text>
          {!!collection.description && (
            <Text numberOfLines={2} style={{ color: Colors.$textNeutralHeavy }}>
              {collection.description}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Text style={{ color: Colors.$textNeutral }}>{count ?? 0} items</Text>
            {visibilityInfo && (
              <>
                <Text style={{ color: Colors.$textNeutral }}>•</Text>
                {VisibilityIcon && <VisibilityIcon size={12} color={Colors.$textNeutral} />}
                <Text style={{ color: Colors.$textNeutral }}>{visibilityInfo.label}</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Collapseable section header ─────────────────────────────────────────────

function CollectionSection({
  title,
  children,
  defaultExpanded = true,
  isEmpty,
}: {
  title: string
  children: React.ReactNode
  defaultExpanded?: boolean
  isEmpty?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const rotation = useSharedValue(defaultExpanded ? 1 : 0)

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }))

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    rotation.value = withTiming(next ? 1 : 0, { duration: 200 })
  }

  if (isEmpty) return null

  return (
    <View style={{ gap: 10 }}>
      <Pressable
        onPress={toggle}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
      >
        <Text
          variant="stats"
          style={{
            flex: 1,
            color: Colors.$textNeutral,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          {title}
        </Text>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={14} color={Colors.$textNeutral} />
        </Animated.View>
      </Pressable>
      {expanded && <View style={{ gap: 10 }}>{children}</View>}
    </View>
  )
}

// ─── Default view: grouped, card-style list ──────────────────────────────────

const DefaultCollectionView = ({ direction }: { direction: 'forward' | 'backward' }) => {
  const { currentPage, setCurrentPage, preferenceState } = useCollectionsPageStore()

  const {
    headerAnimatedStyle,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
    virtualOffset,
  } = useCollaspableHeader()

  const {
    data: collections,
    isLoading: isLoadingCollections,
    refetch,
  } = useViewCollectionForUser(false)

  const { refreshing, onRefresh } = useRefresh([refetch], () => {
    virtualOffset.value = 0
  })

  const { defaultCollections, customCollections } = useMemo(() => {
    const rows = collections ?? []
    return {
      defaultCollections: rows.filter((c) => c.is_vault || c.is_wishlist || c.is_selling),
      customCollections: rows.filter((c) => !c.is_vault && !c.is_wishlist && !c.is_selling),
    }
  }, [collections])

  const navigateTo = useCallback(
    (item: CollectionRow) => {
      const defaultValues = Object.entries(preferenceState.preferences.defaultIds)
      const defaultPage = defaultValues.find(([, id]) => id && id === item.id)
      const isDefaultType = item.is_selling || item.is_vault || item.is_wishlist
      if (!isDefaultType) {
        preferenceState.updatePreferences({
          tabs: Array.from(new Set([...(preferenceState.preferences.tabs ?? []), item.id])),
        })
      }
      setCurrentPage(defaultPage?.[0] ?? item.id)
    },
    [preferenceState, setCurrentPage]
  )

  const skeletons = Array(3).fill(null)

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
            <CollectionBreakdown style={{ paddingTop: 12, paddingHorizontal: 12 }} />
          </View>
        </Animated.View>

        <Animated.ScrollView
          //@ts-ignore
          ref={scrollViewRef}
          onLayout={onListLayout}
          onContentSizeChange={onContentSizeChange}
          scrollEnabled={false}
          bounces={false}
          style={{ marginBottom: 24 }}
          contentContainerStyle={{
            gap: 20,
            paddingHorizontal: 12,
            paddingTop: 18,
            paddingBottom: 24,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <CollectionSection
            title="Collections"
            defaultExpanded
            isEmpty={!isLoadingCollections && defaultCollections.length === 0}
          >
            {isLoadingCollections
              ? skeletons.map((_, i) => (
                  <CollectionCard
                    key={`skeleton-default-${i}`}
                    collection={{} as CollectionRow}
                    onPress={() => {}}
                    isLoading
                  />
                ))
              : defaultCollections.map((c) => (
                  <CollectionCard key={c.id} collection={c} onPress={() => navigateTo(c)} />
                ))}
          </CollectionSection>

          <CollectionSection
            title="My Collections"
            defaultExpanded
            isEmpty={!isLoadingCollections && customCollections.length === 0}
          >
            {isLoadingCollections
              ? skeletons.map((_, i) => (
                  <CollectionCard
                    key={`skeleton-custom-${i}`}
                    collection={{} as CollectionRow}
                    onPress={() => {}}
                    isLoading
                  />
                ))
              : customCollections.map((c) => (
                  <CollectionCard key={c.id} collection={c} onPress={() => navigateTo(c)} />
                ))}
          </CollectionSection>

          {/* Watching section — will populate when collection_follows is added */}
          <CollectionSection title="Watching" defaultExpanded isEmpty>
            {null}
          </CollectionSection>
        </Animated.ScrollView>
      </Animated.View>
    </GestureDetector>
  )
}

const DetailCollectionView = ({ direction }: { direction: 'forward' | 'backward' }) => {
  const { currentPage, setCurrentPage, preferenceState } = useCollectionsPageStore()

  // 'default' is a UI-only page with no backing collection; only wishlist/selling/vault have real IDs
  const isBackedDefaultPage =
    currentPage === 'wishlist' || currentPage === 'selling' || currentPage === 'vault'
  const { data: defaultIds } = useDefaultCollectionIds(isBackedDefaultPage)

  // For backed default pages (wishlist/selling/vault), use the resolved actual collection UUID
  // so the infinite items query key is a flat, ID-based key consistent with regular collections.
  // This ensures onDelete can find and update the query via prefix matching.
  const collectionItemsArgs = useMemo(() => {
    if (isBackedDefaultPage) {
      const resolvedId = defaultIds?.[currentPage as keyof typeof defaultIds]
      if (resolvedId) return { collectionId: resolvedId }
    }
    return getCollectionIdArgs(currentPage)
  }, [isBackedDefaultPage, defaultIds, currentPage])

  const { data: collection } = useGetCollection(getCollectionIdArgs(currentPage))
  const { data: allCollections } = useViewCollectionForUser()
  const { query: collectionItemsQuery } = useGetCollectionItems<CollectionItemQueryView & TCard>(
    collectionItemsArgs,
    { pageSize: 20 },
    true
  )
  const { isLoading: isLoadingItems, refetch: refetchCollectionItems } = collectionItemsQuery
  const { refreshing, onRefresh: handleRefresh } = useRefresh([refetchCollectionItems])

  const collectionItems = useMemo(() => {
    return collectionItemsQuery.data?.pages.flat() ?? []
  }, [collectionItemsQuery.data])

  const listData = useMemo<ListEntry[]>(() => {
    if (isLoadingItems) {
      return Array(4).fill({ type: 'item', data: { kind: 'skeleton' } })
    }

    if (collection?.is_selling && collectionItems.length > 0) {
      const groups = new Map<string | null, (CollectionItemQueryView & TCard)[]>()
      for (const item of collectionItems) {
        const key = item.collection_ref ?? null
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(item)
      }
      const entries: ListEntry[] = []
      for (const [ref, items] of groups) {
        const name = ref
          ? (allCollections?.find((c) => c.id === ref)?.name ?? 'Collection')
          : 'Direct'
        entries.push({ type: 'group', collectionRef: ref, collectionName: name, items })
      }
      return entries
    }

    return collectionItems.map((d) => ({ type: 'item', data: d }))
  }, [collectionItems, isLoadingItems, collection?.is_selling, allCollections])

  const {
    headerAnimatedStyle,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
    expandProgress,
  } = useCollaspableHeader({
    disable: collectionItems.length > 0,
    resetKeys: [currentPage, collection?.id],
  })

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    borderTopWidth: interpolate(expandProgress.value, [0, 1], [2, 0]),
  }))

  const navigateToCollection = useCallback(
    (collectionRef: string | null) => {
      if (!collectionRef) return
      const refCollection = allCollections?.find((c) => c.id === collectionRef)
      if (!refCollection) return
      const isDefaultPage =
        refCollection.is_selling || refCollection.is_vault || refCollection.is_wishlist
      const defaultValues = Object.entries(preferenceState.preferences.defaultIds)
      const defaultPage = defaultValues.find(([, id]) => id && id === collectionRef)
      if (!isDefaultPage) {
        preferenceState.updatePreferences({
          tabs: Array.from(new Set([...(preferenceState.preferences.tabs ?? []), collectionRef])),
        })
      }
      setCurrentPage(defaultPage?.[0] ?? collectionRef)
    },
    [allCollections, preferenceState, setCurrentPage]
  )

  const renderCardItem = useCallback(
    (data: CollectionItemQueryView & TCard, isLast: boolean) => {
      // The collection_item_query JOIN may return null card fields when the card row
      // isn't in the DB yet (fetched only via edge function). Fall back to ref_id so
      // CardListView / CollectionCardItemEntries can resolve the card via useCardQuery.
      const cardId = data.id ?? data.ref_id
      const card = { ...data, id: cardId } as CollectionItemQueryView & TCard

      return (
        <View style={{ position: 'relative', paddingLeft: 12 }}>
          <View
            style={{
              position: 'absolute',
              left: 4,
              top: THUMBNAIL_HEIGHT,
              bottom: 0,
              width: 3,
              marginTop: 8,
              marginBottom: 20,
              backgroundColor: Colors.$outlineNeutral,
              opacity: 0.7,
              borderRadius: 999,
            }}
          />
          {isLast && (
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 0,
                backgroundColor: Colors.$outlineNeutral,
              }}
            />
          )}
          <CardListView
            itemId={card.id}
            card={card}
            renderAccessories={({ isLoading }) => (
              <CollectionCardItemEntries
                key={`${collection?.id}-${cardId}`}
                isLoading={isLoading}
                card={card}
                //@ts-ignore
                collection={collection!}
                isShown
                editable
              />
            )}
            isLoading={isLoadingItems}
          />
        </View>
      )
    },
    [collection, isLoadingItems]
  )

  const renderItem = useCallback(
    ({ item }: { item: ListEntry }) => {
      if (item.type === 'group') {
        return (
          <CollectionGroupContainer
            name={item.collectionName}
            onNavigate={
              item.collectionRef ? () => navigateToCollection(item.collectionRef) : undefined
            }
          >
            {item.items.map((d, i) => (
              <React.Fragment key={d.collection_item_id ?? d.id ?? i}>
                {renderCardItem(d, i === item.items.length - 1)}
              </React.Fragment>
            ))}
          </CollectionGroupContainer>
        )
      }
      return renderCardItem(item.data, false)
    },
    [renderCardItem, navigateToCollection]
  )

  const keyExtractor = useCallback(
    (item: ListEntry, index: number) => {
      if (item.type === 'group') return `group-${item.collectionRef ?? 'direct'}`
      return `item-${currentPage}-${item.data?.collection_item_id ?? item.data?.id ?? `skeleton-${index}`}`
    },
    [currentPage]
  )

  return (
    <GestureDetector gesture={composedGestures}>
      <Animated.ScrollView
        key={currentPage}
        ref={scrollViewRef}
        onLayout={onListLayout}
        onContentSizeChange={onContentSizeChange}
        entering={direction === 'forward' ? FadeInRight.duration(200) : FadeInLeft.duration(200)}
        exiting={direction === 'forward' ? FadeOutLeft.duration(180) : FadeOutRight.duration(180)}
        contentContainerStyle={{
          paddingVertical: 16,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View
          style={{
            backgroundColor: Colors.$backgroundElevatedLight,
            borderRadius: BorderRadiuses.br60,
            borderTopRightRadius: BorderRadiuses.br60,
            overflow: 'hidden',
            borderTopWidth: 2,
            borderColor: Colors.$outlineNeutral,
            borderWidth: 2,
            marginHorizontal: -2,
          }}
        >
          <Animated.View
            key={`header-${currentPage}`}
            style={[
              headerAnimatedStyle,
              {
                overflow: 'hidden',
              },
            ]}
          >
            <View onLayout={onHeaderLayout}>
              <CollectionInfo />
            </View>
          </Animated.View>
          <Animated.View style={[borderAnimatedStyle, { borderColor: Colors.$outlineNeutral }]}>
            <FolderTabsContainer>
              <AnimatedCollectionItemList
                initialNumToRender={10}
                scrollEnabled={false}
                style={{ flex: 1 }}
                bounces={false}
                data={listData}
                contentContainerStyle={{
                  display: 'flex',
                  gap: 18,
                  paddingTop: collection?.is_selling ? 0 : 18,
                  paddingBottom: 20,
                }}
                ListEmptyComponent={EmptyColelctionList}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
              />
            </FolderTabsContainer>
          </Animated.View>
        </View>
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
