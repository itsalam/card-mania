import { CollectionIdArgs } from '@/client/collections/types'
import { Separator } from '@/components/ui/separator'
import { TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MaskedView from '@react-native-masked-view/masked-view'
import { Coins, Heart, Layers, LucideIcon, Plus, Vault, X } from 'lucide-react-native'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutChangeEvent, TouchableOpacity, View } from 'react-native'
import { FlatList } from 'react-native-gesture-handler'

import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { LinearGradient } from 'expo-linear-gradient'
import Animated from 'react-native-reanimated'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { getCollectionName } from '../helpers'
import { useGetCollection } from '../hooks'
import {
  DefaultPageTypes,
  defaultPages,
  getCollectionIdArgs,
  useCollectionsPageStore,
} from '../provider'

type CollectionTabProps = {
  collectionKey: CollectionIdArgs
  onLayout?: (event: LayoutChangeEvent) => void
}

export const CollectionTabList = () => {
  const { currentPage, preferenceState, setCurrentPage, newCollectionInfo } =
    useCollectionsPageStore()
  const { preferences } = preferenceState
  const scrollViewRef = useRef<FlatList>(null)
  const [listWidth, setListWidth] = useState(0)
  const [lastTabWidth, setLastTabWidth] = useState(0)
  const leftPadding = 12
  const trailingSpace = listWidth ? Math.max(listWidth - (lastTabWidth + leftPadding * 2), 0) : 20
  const tabs = useMemo(() => {
    const tabs = [...defaultPages.slice(1), ...(preferences?.tabs ?? [])]
    return tabs
  }, [preferences, defaultPages, currentPage, newCollectionInfo?.name])

  const scrollToIndex = (index: number) =>
    scrollViewRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0,
      viewOffset: leftPadding,
    })

  const scrollToTabKey = (key: string) => {
    const index = tabs.findIndex((tab) => tab === key)
    if (index !== -1) scrollToIndex(index)
  }

  useEffect(() => {
    const index = tabs.findIndex((tab) => tab === currentPage)
    if (currentPage === 'new') {
      scrollViewRef.current?.scrollToOffset({
        animated: true,
        offset: 10000,
      })
    } else if (index !== -1 && scrollViewRef) {
      scrollToTabKey(currentPage)
    }
  }, [tabs, currentPage])

  return (
    <View className="mx-3 pb-2 overflow-hidden mr-5" style={{ borderRadius: BorderRadiuses.br30 }}>
      <TabsList className="p-px pl-0 overflow-visible w-full items-start justify-start">
        <TabsTrigger
          key={defaultPages[0]}
          value={defaultPages[0]}
          style={{
            zIndex: 2,
            backgroundColor: Colors.$backgroundElevated,
            height: '100%',
            padding: 0,
          }}
        >
          <TabsLabel
            value={defaultPages[0]}
            className="text-xl"
            style={{ color: Colors.$textDefault }}
            leftElement={(current) =>
              React.createElement(tabIcons[defaultPages[0]], {
                size: 24,
                color: current ? Colors.$textPrimary : Colors.$textDefault,
                style: { marginBottom: 0 },
              })
            }
          />
        </TabsTrigger>
        <Separator orientation="vertical" className="mb-2 pb-2 z-10" />
        <MaskedView
          style={[
            { flex: 1.0, position: 'relative' },
            currentPage === 'new' && { flex: 0, width: 0, opacity: 0 },
          ]}
          maskElement={
            <LinearGradient
              // MaskedView uses the alpha channel: solid shows content, transparent hides it.
              colors={['transparent', 'black', 'black', 'transparent']}
              start={{ x: 0.0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.025, 0.95, 1]}
              style={{
                position: 'absolute',
                height: '100%',
                width: '100%',
                // top: '-2.5%',
                left: '-0%',
              }}
            />
          }
        >
          <FlatList
            ref={scrollViewRef}
            horizontal
            scrollIndicatorInsets={{ bottom: -10 }}
            style={{ overflow: 'visible', zIndex: 0 }}
            data={tabs}
            keyExtractor={(tab, i) => `${tab}-${i}`}
            renderItem={({ item: tab, index }) => (
              <CollectionTab
                key={tab}
                collectionKey={getCollectionIdArgs(tab as (typeof defaultPages)[number])}
                onLayout={
                  index === tabs.length - 1
                    ? (event) => {
                        const width = Math.round(event.nativeEvent.layout.width)
                        if (width && width !== lastTabWidth) setLastTabWidth(width)
                      }
                    : undefined
                }
              />
            )}
            contentContainerStyle={{
              paddingLeft: leftPadding,
              paddingRight: leftPadding,
              display: 'flex',
              flexDirection: 'row',
              gap: 0,
              zIndex: -1,
            }}
            onLayout={(event) => {
              const width = Math.round(event.nativeEvent.layout.width)
              if (width && width !== listWidth) setListWidth(width)
            }}
            onScrollToIndexFailed={(info) => {
              const wait = new Promise((resolve) => setTimeout(resolve, 100))
              wait.then(() => {
                scrollToIndex(info.index)
              })
            }}
            ListFooterComponent={
              <>
                <View style={{ width: trailingSpace }} />
              </>
            }
          >
            {/* </View> */}
          </FlatList>
        </MaskedView>
        <Animated.View
          style={[
            {
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'stretch',
            },
            currentPage === 'new' ? { flex: 1 } : { flexGrow: 0, flexShrink: 0 },
          ]}
        >
          {currentPage !== 'new' ? (
            <TouchableOpacity
              style={{
                alignSelf: 'stretch',
                padding: 8,
              }}
              onPress={() => setCurrentPage('new')}
            >
              <View
                style={{
                  borderColor: Colors.$outlineDefault,
                  display: 'flex',
                  borderWidth: 2,
                  borderRadius: BorderRadiuses.br40,
                  justifyContent: 'center',
                  alignItems: 'center',
                  aspectRatio: 1,
                }}
              >
                <Plus size={18} color={Colors.$textDefault} />
              </View>
            </TouchableOpacity>
          ) : (
            <TabsLabel
              label={newCollectionInfo?.name?.length ? newCollectionInfo?.name : 'New Collection'}
              value={'new'}
              className="text-xl"
              style={{
                color: Colors.$textDefault,
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                textAlignVertical: 'center',
              }}
              containerStyle={{
                padding: 6,
                paddingHorizontal: 12,
                borderRadius: BorderRadiuses.br30,
                borderColor: Colors.$outlineGeneral,
                borderWidth: 2,
                flex: 1,
              }}
            />
          )}
        </Animated.View>
      </TabsList>
    </View>
  )
}

const CollectionTab = ({ collectionKey, onLayout }: CollectionTabProps) => {
  const { currentPage, preferenceState, setCurrentPage } = useCollectionsPageStore()

  const key = [...Object.values(collectionKey)][0]

  const isDefault = Boolean(collectionKey.collectionType)
  const isCurrent = currentPage === key
  const { data: collection } = useGetCollection(collectionKey)
  const label = getCollectionName({ collectionKey, collection })

  return (
    <View style={{ flexGrow: 0, flexShrink: 0 }} onLayout={onLayout}>
      <TabsTrigger key={key} value={key} className="pt-px p-0">
        <TabsLabel
          label={label}
          value={key}
          className="text-xl"
          style={{
            color: Colors.$textDefault,
          }}
          containerStyle={{
            padding: 6,
            paddingHorizontal: 12,
            borderRadius: BorderRadiuses.br30,
            ...(isCurrent
              ? { borderColor: Colors.$outlineGeneral, borderWidth: 2 }
              : { padding: 8 }),
          }}
          leftElement={(current: boolean) =>
            label?.length ? (
              React.createElement(tabIcons[key as keyof typeof tabIcons] ?? tabIcons['default'], {
                size: 20,
                color: current ? Colors.$textPrimary : Colors.$textDefault,
              })
            ) : (
              <Spinner />
            )
          }
          rightElement={(current: boolean) =>
            current && !isDefault ? (
              <TouchableOpacity
                hitSlop={10}
                onPress={() =>
                  preferenceState
                    .updatePreferences({
                      tabs: Array.from(
                        new Set([
                          ...(preferenceState.preferences.tabs?.filter((t) => t !== key) ?? []),
                        ])
                      ),
                    })
                    .then(() => setCurrentPage('default'))
                }
              >
                <X size={16} color={current ? Colors.$textPrimary : Colors.$textDefault} />
              </TouchableOpacity>
            ) : !label?.length ? (
              <Skeleton style={{ borderRadius: 999, width: 48, height: 18 }} />
            ) : null
          }
        />
      </TabsTrigger>
    </View>
  )
}

const tabIcons: Record<DefaultPageTypes, LucideIcon> = {
  default: Layers,
  vault: Vault,
  wishlist: Heart,
  selling: Coins,
}
