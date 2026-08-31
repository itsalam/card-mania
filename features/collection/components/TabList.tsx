import { CollectionIdArgs } from '@/client/collections/types'
import { WishlistCard } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { TabsLabel, TabsScrollList, TabsTrigger } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text'
import { OnboardingTarget, useOnboardingStore } from '@/features/onboarding'
import { Coins, Layers, LucideIcon, Plus, Vault, X } from 'lucide-react-native'
import React, { useEffect, useRef } from 'react'
import { LayoutChangeEvent, TouchableOpacity, View } from 'react-native'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { getCollectionName } from '../helpers'
import { useDefaultCollectionIds, useGetCollection } from '../hooks'
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
  const { currentPage, pinnedCollectionsState, setCurrentPage, newCollectionInfo } =
    useCollectionsPageStore()
  const { data: defaultIds } = useDefaultCollectionIds()
  const hasCollectionName = Boolean(newCollectionInfo?.name?.length)
  const collectionTitleLabel = newCollectionInfo?.name?.length
    ? newCollectionInfo.name
    : 'New Collection'

  const tabs = React.useMemo(() => {
    const defaultIdValues = Object.values(defaultIds ?? {}).filter(Boolean) as string[]
    const customIds = pinnedCollectionsState.data
      .map((row) => row.collection_id)
      .filter((id): id is string => !!id && !defaultIdValues.includes(id))
    return [...new Set([...defaultPages.slice(1), ...customIds])]
  }, [pinnedCollectionsState.data, defaultIds])

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

  // ── Right slot: add button ────────────────────────────────────────────────
  const rightSlot = (
    <OnboardingTarget id="collection-new-button" style={{ alignSelf: 'stretch' }}>
      <TouchableOpacity
        // flex: 1, not alignSelf: 'stretch' — OnboardingTarget's own wrapper View sits between
        // this and the row, and it's a column-direction container (RN's default), so alignSelf
        // here would stretch along the WRONG (horizontal) axis. flex: 1 fills the wrapper's
        // main axis (vertical, matching the row's cross-axis height) correctly regardless of
        // the wrapper's direction. Was previously the row's direct child, where alignSelf:
        // 'stretch' was correct — this squished/shifted the icon off-center.
        style={{ flex: 1, padding: 8 }}
        onPress={() => {
          // Real user action, not the tour panel's own Next — see COLLECTION_TOUR_STEPS'
          // comment in features/onboarding/steps.ts for why cross-screen steps advance here.
          useOnboardingStore.getState().advanceIfCurrentStep('collection-new-button')
          setCurrentPage('new')
        }}
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
    </OnboardingTarget>
  )

  return (
    <OnboardingTarget id="collection-pinned-header">
      <View className="mx-3 overflow-hidden mr-5" style={{ gap: 6 }}>
        <Text
          variant="stats"
          style={{
            paddingLeft: 12,
            color: Colors.$textNeutral,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          Pinned
        </Text>
        {currentPage === 'new' ? (
          // TabsScrollList's middle scroll area claims half the row's width via its own
          // flex: 1 wrapper even with nothing inside it (no tab items render while creating a
          // collection) — splitting space with a label that should instead have the whole row.
          // Rendering the "New Collection" label directly here, replicating TabsScrollList's own
          // chrome (bg/border/radius/minHeight) rather than going through it, gives the label the
          // full width instead of half of it.
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 44,
              paddingHorizontal: 12,
              backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
              borderWidth: 1,
              borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
              borderRadius: 999,
            }}
          >
            <TabsLabel
              label={collectionTitleLabel}
              value="new"
              style={{
                // Still just a stand-in for the real title — styled as secondary text (dimmer
                // color, regular weight, not TabsLabel's own default bold h4) until the user
                // actually types a name, at which point it should read like a real title.
                color: hasCollectionName ? Colors.$textDefault : Colors.$textNeutral,
                fontWeight: hasCollectionName ? '600' : '400',
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                textAlignVertical: 'center',
              }}
              containerStyle={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </View>
        ) : (
          <TabsScrollList
            masked
            leftSlot={leftSlot}
            rightSlot={rightSlot}
            style={{
              // Match the previous TabsList overrides
              paddingVertical: 0,
              minHeight: 44,
            }}
          >
            {tabs.map((tab, index) => (
              <CollectionTab
                key={`${tab}-${index}`}
                collectionKey={getCollectionIdArgs(tab as (typeof defaultPages)[number])}
              />
            ))}
          </TabsScrollList>
        )}
      </View>
    </OnboardingTarget>
  )
}

const CollectionTab = ({ collectionKey, onLayout }: CollectionTabProps) => {
  const { currentPage, pinnedCollectionsState, setCurrentPage } = useCollectionsPageStore()

  const key = [...Object.values(collectionKey)][0] as string

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
      pinnedCollectionsState.remove(key)
      if (currentPage === key) setCurrentPage('default')
    }
  }, [currentPage, isDefault, key, other.error, pinnedCollectionsState, setCurrentPage])

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
              onPress={() => {
                pinnedCollectionsState.remove(key)
                setCurrentPage('default')
              }}
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
