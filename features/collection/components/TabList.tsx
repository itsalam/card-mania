import { CollectionIdArgs } from '@/client/collections/types'
import { WishlistCard } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { TabsLabel, TabsScrollList, TabsTrigger } from '@/components/ui/tabs'
import { Coins, Layers, LucideIcon, Plus, Vault, X } from 'lucide-react-native'
import React, { useEffect, useRef } from 'react'
import { LayoutChangeEvent, TouchableOpacity, View } from 'react-native'
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

  const tabs = React.useMemo(() => {
    return [...new Set([...defaultPages.slice(1), ...(preferences?.tabs ?? [])])]
  }, [preferences?.tabs])

  // ── Left slot: the "default" (all collections) trigger ──────────────────
  const leftSlot = (
    <TabsTrigger
      value={defaultPages[0]}
      style={{
        zIndex: 2,
        backgroundColor: Colors.$backgroundElevated,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        borderRightWidth: 1,
        borderWidth: 0,
        paddingLeft: 14,
        paddingRight: 10,
        borderColor: Colors.$outlineDefault,
        height: '100%',
        padding: 0,
      }}
    >
      <TabsLabel
        value={defaultPages[0]}
        style={{ color: Colors.$textDefault }}
        leftElement={(current) =>
          React.createElement(tabIcons[defaultPages[0]], {
            size: 13,
            color: current ? Colors.$backgroundPrimaryHeavy : Colors.$textNeutral,
            style: { marginBottom: 0 },
          })
        }
      />
    </TabsTrigger>
  )

  // ── Right slot: add button OR new collection label ───────────────────────
  const rightSlot =
    currentPage !== 'new' ? (
      <TouchableOpacity
        style={{ alignSelf: 'stretch', padding: 8 }}
        onPress={() => setCurrentPage('new')}
      >
        <View
          style={{
            borderColor: Colors.$outlineDefault,
            borderWidth: 2,
            borderRadius: BorderRadiuses.br40,
            justifyContent: 'center',
            alignItems: 'center',
            aspectRatio: 1,
            flex: 1,
          }}
        >
          <Plus size={18} color={Colors.$textDefault} />
        </View>
      </TouchableOpacity>
    ) : (
      <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <TabsLabel
          label={newCollectionInfo?.name?.length ? newCollectionInfo.name : 'New Collection'}
          value="new"
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
      </Animated.View>
    )

  return (
    <View className="mx-3 overflow-hidden mr-5" style={{ borderRadius: BorderRadiuses.br30 }}>
      <TabsScrollList
        masked
        leftSlot={leftSlot}
        rightSlot={rightSlot}
        style={{
          // Match the previous TabsList overrides
          paddingVertical: 0,
        }}
      >
        {currentPage !== 'new' &&
          tabs.map((tab, index) => (
            <CollectionTab
              key={`${tab}-${index}`}
              collectionKey={getCollectionIdArgs(tab as (typeof defaultPages)[number])}
            />
          ))}
      </TabsScrollList>
    </View>
  )
}

const CollectionTab = ({ collectionKey, onLayout }: CollectionTabProps) => {
  const { currentPage, preferenceState, setCurrentPage } = useCollectionsPageStore()

  const key = [...Object.values(collectionKey)][0]

  const handledMissingRef = useRef(false)
  const isDefault = Boolean(collectionKey.collectionType)
  const isCurrent = currentPage === key
  const { data: collection, ...other } = useGetCollection(collectionKey)
  const label = getCollectionName({ collectionKey, collection })

  useEffect(() => {
    if (handledMissingRef.current) return
    const fetchError = other.error as { code?: string; message?: string } | null
    const missingCollection =
      fetchError &&
      (!fetchError.code ||
        fetchError.code === 'PGRST116' ||
        fetchError.message?.toLowerCase?.().includes('not found'))

    if (!isDefault && missingCollection) {
      handledMissingRef.current = true
      const nextTabs = (preferenceState.preferences.tabs ?? []).filter((t) => t !== key)
      preferenceState
        .updatePreferences({ tabs: nextTabs })
        .then(() => {
          if (currentPage === key) setCurrentPage('default')
        })
        .catch(() => {})
    }
  }, [currentPage, isDefault, key, other.error, preferenceState, setCurrentPage])

  return (
    <TabsTrigger
      value={key}
      onLayout={onLayout}
      style={{
        flexGrow: 0,
        flexShrink: 0,
        marginVertical: 3,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TabsLabel
        label={label}
        value={key}
        style={{
          color: isCurrent ? Colors.$textDefault : Colors.$textNeutral,
        }}
        leftElement={(current: boolean) =>
          label?.length ? (
            React.createElement(tabIcons[key as keyof typeof tabIcons] ?? tabIcons['default'], {
              size: 13,
              color: current ? Colors.$textDefault : Colors.$textNeutral,
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
              <X size={13} color={Colors.$backgroundPrimaryHeavy} />
            </TouchableOpacity>
          ) : !label?.length ? (
            <Skeleton style={{ borderRadius: 999, width: 48, height: 18 }} />
          ) : null
        }
      />
    </TabsTrigger>
  )
}

const tabIcons: Record<DefaultPageTypes, LucideIcon> = {
  default: Layers,
  vault: Vault,
  wishlist: WishlistCard,
  selling: Coins,
}
