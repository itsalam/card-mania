import { CollectionIdArgs } from '@/client/collections/types'
import { Separator } from '@/components/ui/separator'
import { TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MaskedView from '@react-native-masked-view/masked-view'
import { Coins, Heart, Layers, LucideIcon, Plus, Vault, X } from 'lucide-react-native'
import React, { useEffect, useRef } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { FlatList } from 'react-native-gesture-handler'

import { LinearGradient } from 'expo-linear-gradient'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { useGetCollection } from '../hooks'
import {
  DefaultPageTypes,
  defaultPages,
  getCollectionIdArgs,
  useCollectionsPageStore,
} from '../provider'

export const CollectionTabList = () => {
  const { currentPage, preferenceState } = useCollectionsPageStore()
  const { preferences } = preferenceState
  const scrollViewRef = useRef<FlatList>(null)
  const tabs = preferences.tabs ?? defaultPages.slice(1)

  const scrollToIndex = (index: number) =>
    scrollViewRef.current?.scrollToIndex({
      index,
      animated: true,
      // viewOffset: 20,
      viewPosition: 0.1,
    })

  useEffect(() => {
    const index = tabs.findIndex((tab) => tab === currentPage)
    if (index !== -1 && scrollViewRef) {
      scrollToIndex(index)
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
          style={{ flex: 1.0, position: 'relative' }}
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
            renderItem={({ item: tab }) => (
              <CollectionTab
                key={tab}
                collectionKey={getCollectionIdArgs(tab as (typeof defaultPages)[number])}
              />
            )}
            contentContainerStyle={{
              paddingLeft: 4,
              paddingRight: 20,
              display: 'flex',
              flexDirection: 'row',
              gap: 0,
              zIndex: -1,
            }}
            onScrollToIndexFailed={(info) => {
              const wait = new Promise((resolve) => setTimeout(resolve, 100))
              wait.then(() => {
                scrollToIndex(info.index)
              })
            }}
            ListFooterComponent={
              <TouchableOpacity
                style={{
                  alignSelf: 'stretch',
                  aspectRatio: 1,
                  padding: 8,
                }}
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
            }
          >
            {/* </View> */}
          </FlatList>
        </MaskedView>
      </TabsList>
    </View>
  )
}

const CollectionTab = (props: { collectionKey: CollectionIdArgs }) => {
  const { collectionKey } = props
  const { currentPage } = useCollectionsPageStore()

  const key = [...Object.values(collectionKey)][0]
  const isDefault = Boolean(collectionKey.collectionType)
  const isCurrent = currentPage === key
  const { data: collection } = useGetCollection(collectionKey)
  const label = collection?.name ?? [...Object.values(collectionKey)][0].slice(0, 20)

  return (
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
          ...(isCurrent ? { borderColor: Colors.$outlineGeneral, borderWidth: 2 } : { padding: 8 }),
        }}
        leftElement={(current: boolean) =>
          React.createElement(tabIcons[key as keyof typeof tabIcons] ?? tabIcons['default'], {
            size: 20,
            color: current ? Colors.$textPrimary : Colors.$textDefault,
          })
        }
        rightElement={(current: boolean) =>
          current && !isDefault ? (
            <X size={16} color={current ? Colors.$textPrimary : Colors.$textDefault} />
          ) : null
        }
      />
    </TabsTrigger>
  )
}

const tabIcons: Record<DefaultPageTypes, LucideIcon> = {
  default: Layers,
  vault: Vault,
  wishlist: Heart,
  selling: Coins,
}
