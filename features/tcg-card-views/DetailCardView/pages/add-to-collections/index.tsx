import { useViewCollectionsForCard } from '@/client/collections/query'
import { CollectionItem, CollectionLike } from '@/client/collections/types'
import { BlurBackground } from '@/components/Background'
import { ExpandableCollectionEntryListItem } from '@/components/collections/items/expandable-entry-item'
import { SearchBar } from '@/components/ui/search'
import { Text } from '@/components/ui/text/base-text'
import { getSupabase } from '@/lib/store/client'
import { viewCollectionItemsForCard } from '@/lib/store/functions/collections'
import { qk } from '@/lib/store/functions/helpers'
import { useRequiredUserId } from '@/lib/store/useUserStore'
import { useQueryClient } from '@tanstack/react-query'
import { PanelBottomClose, Plus } from 'lucide-react-native'
import React, { useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Colors, Spacings } from 'react-native-ui-lib'
import { FooterButton } from '../../footer/components/button'
import { useCardDetails } from '../../provider'

export const AddToCollectionsView = () => {
  const { card, setPage, setFooterFullView, setPendingRollback } = useCardDetails()
  const qc = useQueryClient()
  const [query, setQuery] = useState<string>()
  const { data: collection } = useViewCollectionsForCard(card?.id, query)

  const username = useRequiredUserId()

  // Effect 1 — capture included collection IDs once on first data arrival
  const [initialIncludedIds, setInitialIncludedIds] = useState<Set<string> | null>(null)
  useEffect(() => {
    if (collection && initialIncludedIds === null) {
      setInitialIncludedIds(
        new Set(
          collection.included
            .map((c) => c.id)
            .filter((id): id is string => !!id && id !== 'wishlist')
        )
      )
    }
  }, [collection, initialIncludedIds])

  // Effect 2 — eager-fetch items for all initially-included collections
  const [initialItemsSnapshot, setInitialItemsSnapshot] = useState<Map<string, CollectionItem[]>>(
    new Map()
  )
  const [snapshotReady, setSnapshotReady] = useState(false)
  useEffect(() => {
    if (!initialIncludedIds || !card?.id || snapshotReady) return
    const cardId = card.id
    const snap = new Map<string, CollectionItem[]>()
    console.log('[AddToCollections] snapshotting', initialIncludedIds.size, 'collections')
    Promise.all(
      [...initialIncludedIds].map(async (colId) => {
        const key = [...qk.collectionItems(colId), 'cardId', cardId]
        const cached = qc.getQueryData<CollectionItem[]>(key)
        if (cached) {
          console.log('[AddToCollections] snapshot from cache', colId, cached.length, 'items')
          snap.set(colId, cached)
          return
        }
        try {
          const items = await viewCollectionItemsForCard(colId, cardId)
          console.log('[AddToCollections] snapshot from DB', colId, items?.length ?? 0, 'items')
          if (items) {
            qc.setQueryData(key, items)
            snap.set(colId, items as CollectionItem[])
          }
        } catch (e) {
          console.warn('[AddToCollections] snapshot fetch failed for', colId, e)
        }
      })
    ).then(() => {
      console.log('[AddToCollections] snapshot ready, collections:', [...snap.keys()])
      setInitialItemsSnapshot(snap)
      setSnapshotReady(true)
    })
  }, [initialIncludedIds, card?.id, snapshotReady])

  // Stable refs so recompute can build a fresh execute without re-triggering the store.
  // executeRef always holds the latest rollback logic; lastCountRef avoids calling
  // setPendingRollback when the count hasn't changed (prevents Zustand → re-render → observer
  // event → recompute → Zustand … infinite loop).
  const executeRef = useRef<(() => Promise<void>) | null>(null)
  const lastCountRef = useRef<number | null>(null)

  // Effect 3 — subscribe to QueryCache; recompute diff and register rollback on data changes
  useEffect(() => {
    if (!snapshotReady || !card?.id || !initialIncludedIds || !username) return
    const cardId = card.id
    console.log('[AddToCollections] subscriber active, snapshot size:', initialItemsSnapshot.size)

    const recompute = () => {
      // The cache stores CollectionLike[] (flat array); the included/excluded split is derived
      // inside useViewCollectionsForCard's useMemo and is never written to cache.
      const allCollections =
        qc.getQueryData<CollectionLike[]>(qk.collectionForCard(cardId, username)) ?? []

      const newlyAdded = allCollections.filter(
        (c): c is CollectionLike & { id: string } =>
          !!c.id && c.id !== 'wishlist' && !initialIncludedIds.has(c.id) && !!c.has_item
      )

      const modifiedColIds: string[] = []
      for (const [colId, snap] of initialItemsSnapshot) {
        const cur =
          qc.getQueryData<CollectionItem[]>([...qk.collectionItems(colId), 'cardId', cardId]) ?? []
        const changed =
          cur.some((ci) => {
            const s = snap.find((si) => si.id === ci.id)
            return (
              !s || s.quantity !== ci.quantity || s.grade_condition_id !== ci.grade_condition_id
            )
          }) || snap.some((si) => !cur.find((ci) => ci.id === si.id))
        console.log('[AddToCollections] diff', colId, {
          snapQtys: snap.map((i) => i.quantity),
          curQtys: cur.map((i) => i.quantity),
          changed,
        })
        if (changed) modifiedColIds.push(colId)
      }

      const totalCount = newlyAdded.length + modifiedColIds.length
      console.log('[AddToCollections] recompute', {
        newlyAdded: newlyAdded.length,
        modified: modifiedColIds.length,
        totalCount,
      })

      // Always keep the execute ref fresh so undo always uses current state.
      executeRef.current =
        totalCount > 0
          ? async () => {
              await Promise.all(
                newlyAdded.map((col) =>
                  getSupabase()
                    .from('collection_items')
                    .delete()
                    .eq('collection_id', col.id)
                    .eq('ref_id', cardId)
                )
              )
              for (const [colId, snap] of initialItemsSnapshot) {
                const key = [...qk.collectionItems(colId), 'cardId', cardId]
                const cur = qc.getQueryData<CollectionItem[]>(key) ?? []
                const toDelete = cur.filter((ci) => !snap.find((si) => si.id === ci.id))
                const toRestore = snap.filter((si) => {
                  const ci = cur.find((i) => i.id === si.id)
                  return (
                    !ci ||
                    ci.quantity !== si.quantity ||
                    ci.grade_condition_id !== si.grade_condition_id
                  )
                })
                await Promise.all(
                  toDelete.map((item) =>
                    getSupabase().from('collection_items').delete().eq('id', item.id)
                  )
                )
                if (toRestore.length) {
                  await getSupabase()
                    .from('collection_items')
                    .upsert(
                      toRestore.map(
                        ({
                          id,
                          collection_id,
                          ref_id,
                          quantity,
                          grade_condition_id,
                          grading_company,
                          item_kind,
                          user_id,
                        }) => ({
                          id,
                          collection_id,
                          ref_id,
                          quantity,
                          grade_condition_id,
                          grading_company,
                          item_kind,
                          user_id,
                        })
                      )
                    )
                }
              }
              qc.invalidateQueries({ queryKey: qk.collectionForCard(cardId, username) })
              for (const colId of [
                ...newlyAdded.map((c) => c.id),
                ...initialItemsSnapshot.keys(),
              ]) {
                qc.invalidateQueries({ queryKey: qk.collectionItems(colId) })
              }
            }
          : null

      // Only update the Zustand store when the count changes — prevents the
      // setPendingRollback → re-render → observer event → recompute → repeat loop.
      if (totalCount === lastCountRef.current) return
      lastCountRef.current = totalCount

      if (totalCount === 0) {
        setPendingRollback(null)
      } else {
        // Delegate to the ref so the stored execute always calls the latest closure.
        setPendingRollback({
          count: totalCount,
          execute: () => executeRef.current?.() ?? Promise.resolve(),
        })
      }
    }

    // Prefixes of query keys we care about. Any 'updated' event whose key does
    // not start with one of these prefixes is from an unrelated query (e.g. the
    // AddCardToCollection search screen's per-card item queries) and can be skipped.
    const watchedPrefixes = [
      qk.collectionForCard(cardId, username),
      ...[...initialIncludedIds].map((colId) => qk.collectionItems(colId)),
    ]
    const isRelevantKey = (key: ReadonlyArray<unknown>) =>
      watchedPrefixes.some((prefix) => prefix.every((seg, i) => key[i] === seg))

    // Only react to actual data changes on watched keys — skip observer lifecycle
    // events ('observerAdded', 'observerRemoved', 'observerResultsUpdated') which
    // fire on every re-render, and skip unrelated queries from other screens.
    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && isRelevantKey(event.query.queryKey as ReadonlyArray<unknown>))
        recompute()
    })
    recompute()
    return () => {
      unsubscribe()
      lastCountRef.current = null
      setPendingRollback(null)
    }
  }, [snapshotReady, card?.id, initialIncludedIds, initialItemsSnapshot])

  return (
    <>
      <ScrollView
        style={{
          flex: 1,
          alignSelf: 'stretch',
          overflow: 'visible',
          display: 'flex',
          // gap: Spacings.s2,
        }}
      >
        <View style={{ width: '100%', paddingHorizontal: Spacings.s4, paddingBottom: Spacings.s2 }}>
          <SearchBar onChangeText={setQuery} />
        </View>
        {!!collection?.included.length && (
          <>
            <Text style={{ paddingHorizontal: Spacings.s4 }}>Saved In</Text>
            <View className="py-2 flex flex-col">
              {collection?.included.map((c) => (
                <ExpandableCollectionEntryListItem
                  card={card ?? undefined}
                  key={c.id}
                  collection={c}
                />
              ))}
            </View>
          </>
        )}
        {!!collection?.excluded && (
          <>
            {collection?.included.length && (
              <Text style={{ paddingHorizontal: Spacings.s4 }}>Other Collections</Text>
            )}
            <View className="py-2 flex flex-col gap-2">
              {collection?.excluded.length ? (
                collection?.excluded.map((c) => (
                  <ExpandableCollectionEntryListItem
                    card={card ?? undefined}
                    key={c.id}
                    collection={c}
                  />
                ))
              ) : (
                <View className="pt-4 flex items-center justify-center">
                  <Text className="text-sm text-muted-foreground italic">No other collections</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <BlurBackground className="w-full flex flex-row pt-2 gap-4 px-4">
        <FooterButton
          highLighted
          style={{ flexGrow: 1, flex: 1, width: '100%' }}
          onPress={() => setPage(1)}
          label="New Collection"
          iconSource={(style) => <Plus style={style} color={Colors.$iconDefaultLight} />}
        />
        <FooterButton
          style={{
            flexShrink: 1,
            backgroundColor: Colors.$backgroundPrimaryMedium,
          }}
          onPress={() => setFooterFullView(false)}
          label="Done"
          iconSource={(style) => (
            <PanelBottomClose color={Colors.$iconDefaultLight} style={style} />
          )}
        />
      </BlurBackground>
    </>
  )
}
