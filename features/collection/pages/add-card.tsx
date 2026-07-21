import { CollectionItem, CollectionLike } from '@/client/collections/types'
import { ShoulderCutoutDescriptor } from '@/components/Background'
import { AppStandaloneHeader, PILL_H, PILL_R } from '@/components/ui/headers'
import { Text } from '@/components/ui/text/base-text'
import { TCard } from '@/constants/types'
import { SearchScreen } from '@/features/mainSearchbar/components/SearchScreen'
import { CollectionCardItemEntries } from '@/features/tcg-card-views/DetailCardView/pages/add-to-collections/components'
import { ItemListViewProps } from '@/features/tcg-card-views/types'
import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Check, RotateCcw } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { SharedValue, useSharedValue } from 'react-native-reanimated'
import { useGetCollection } from '../hooks'

const AddCardToCollectionAccessories = ({
  collection,
  ...props
}: ItemListViewProps & { collection: CollectionLike | undefined }) => {
  if (!collection) return null
  return (
    <CollectionCardItemEntries
      card={props.item as TCard}
      collection={collection}
      isShown
      isSearch
    />
  )
}

export default function AddCardToCollection({ collectionId }: { collectionId: string }) {
  const { data: collection } = useGetCollection({ collectionId })
  const qc = useQueryClient()

  // --- snapshot: cardId → items at session open ---
  const [initialSnapshot, setInitialSnapshot] = useState<Map<string, CollectionItem[]> | null>(null)
  const [snapshotReady, setSnapshotReady] = useState(false)

  useEffect(() => {
    if (snapshotReady || !collectionId) return
    getSupabase()
      .from('collection_items')
      .select('*')
      .eq('collection_id', collectionId)
      .then(({ data }) => {
        const snap = new Map<string, CollectionItem[]>()
        for (const item of data ?? []) {
          const existing = snap.get(item.ref_id) ?? []
          snap.set(item.ref_id, [...existing, item as CollectionItem])
        }
        setInitialSnapshot(snap)
        setSnapshotReady(true)
      })
  }, [collectionId, snapshotReady])

  // --- rollback state ---
  const [pendingRollback, setPendingRollback] = useState<{
    count: number
    execute: () => Promise<void>
  } | null>(null)

  const executeRef = useRef<(() => Promise<void>) | null>(null)
  const lastCountRef = useRef<number | null>(null)

  useEffect(() => {
    if (!snapshotReady || !collectionId || !initialSnapshot) return

    const prefix = qk.collectionItems(collectionId) as ReadonlyArray<unknown>

    const recompute = () => {
      const changedCardIds: string[] = []
      const newlyAddedCardIds: string[] = []

      // Inspect every cached per-card query under this collection
      const allQueries = qc.getQueryCache().findAll({ queryKey: [...prefix] })
      for (const query of allQueries) {
        const key = query.queryKey as string[]
        const cardIdIdx = key.indexOf('cardId')
        if (cardIdIdx === -1 || cardIdIdx >= key.length - 1) continue
        const cardId = key[cardIdIdx + 1]
        if (!cardId) continue

        const currentItems = (query.state.data as CollectionItem[] | undefined) ?? []
        const snapItems = initialSnapshot.get(cardId) ?? []

        if (snapItems.length === 0 && currentItems.some((i) => (i.quantity ?? 0) > 0)) {
          newlyAddedCardIds.push(cardId)
        } else {
          const changed =
            currentItems.some((ci) => {
              const si = snapItems.find((s) => s.id === ci.id)
              return (
                !si ||
                si.quantity !== ci.quantity ||
                si.grade_condition_id !== ci.grade_condition_id
              )
            }) || snapItems.some((si) => !currentItems.find((ci) => ci.id === si.id))
          if (changed) changedCardIds.push(cardId)
        }
      }

      const totalCount = newlyAddedCardIds.length + changedCardIds.length

      executeRef.current =
        totalCount > 0
          ? async () => {
              // Pre-compute server targets and save current cache before modifying it.
              const prevCache = new Map<string, CollectionItem[]>()
              const toDeleteItems: CollectionItem[] = []
              const toRestoreItems: CollectionItem[] = []

              for (const cardId of newlyAddedCardIds) {
                const key = [...qk.collectionItems(collectionId), 'cardId', cardId]
                prevCache.set(cardId, qc.getQueryData<CollectionItem[]>(key) ?? [])
              }
              for (const cardId of changedCardIds) {
                const key = [...qk.collectionItems(collectionId), 'cardId', cardId]
                const cur = qc.getQueryData<CollectionItem[]>(key) ?? []
                const snapItems = initialSnapshot.get(cardId) ?? []
                prevCache.set(cardId, cur)
                toDeleteItems.push(...cur.filter((ci) => !snapItems.find((si) => si.id === ci.id)))
                toRestoreItems.push(
                  ...snapItems.filter((si) => {
                    const ci = cur.find((i) => i.id === si.id)
                    return (
                      !ci ||
                      ci.quantity !== si.quantity ||
                      ci.grade_condition_id !== si.grade_condition_id
                    )
                  })
                )
              }

              // Immediately close the animation without waiting for per-card setQueryData
              // calls to each fire recompute(). Setting lastCountRef to 0 blocks those
              // intermediate recompute() calls (they short-circuit on totalCount === 0)
              // so no intermediate wideW write can flip the animation back open mid-loop.
              // Error recovery still works: restoring prevCache makes totalCount > 0,
              // which bypasses the guard and re-shows the rollback button.
              lastCountRef.current = 0
              pillWSv.value = narrowWidthRef.current
              setPendingRollback(null)

              // Apply snapshot to cache (each setQueryData fires recompute() but it
              // returns early because totalCount = 0 = lastCountRef.current).
              for (const cardId of newlyAddedCardIds) {
                qc.setQueryData([...qk.collectionItems(collectionId), 'cardId', cardId], [])
              }
              for (const cardId of changedCardIds) {
                qc.setQueryData(
                  [...qk.collectionItems(collectionId), 'cardId', cardId],
                  initialSnapshot.get(cardId) ?? []
                )
              }

              try {
                await Promise.all([
                  ...newlyAddedCardIds.map((cardId) =>
                    getSupabase()
                      .from('collection_items')
                      .delete()
                      .eq('collection_id', collectionId)
                      .eq('ref_id', cardId)
                  ),
                  ...toDeleteItems.map((item) =>
                    getSupabase().from('collection_items').delete().eq('id', item.id)
                  ),
                ])
                if (toRestoreItems.length) {
                  await getSupabase()
                    .from('collection_items')
                    .upsert(
                      toRestoreItems.map(
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
                qc.invalidateQueries({ queryKey: [...prefix] })
              } catch {
                // Server failed: restore cache → recompute() re-detects changes → rollback button reappears
                for (const [cardId, prev] of prevCache) {
                  qc.setQueryData([...qk.collectionItems(collectionId), 'cardId', cardId], prev)
                }
              }
            }
          : null

      if (totalCount === lastCountRef.current) return
      lastCountRef.current = totalCount

      if (totalCount === 0) {
        // Start the spring synchronously — this runs inside the event handler before
        // any React re-renders, so the animation begins on the same frame as the change.
        if (narrowWidthRef.current > 0) pillWSv.value = narrowWidthRef.current
        setPendingRollback(null)
      } else {
        if (wideWidthRef.current > 0) pillWSv.value = wideWidthRef.current
        setPendingRollback({
          count: totalCount,
          execute: () => executeRef.current?.() ?? Promise.resolve(),
        })
      }
    }

    const isRelevantKey = (key: ReadonlyArray<unknown>) => prefix.every((seg, i) => key[i] === seg)

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
  }, [snapshotReady, collectionId, initialSnapshot])

  // Stable accessories — only recreate when collection identity changes
  const itemAccessories = useCallback<
    NonNullable<React.ComponentProps<typeof SearchScreen>['itemAccessories']>
  >(
    (props) => (
      <AddCardToCollectionAccessories
        collection={collection as CollectionLike | undefined}
        {...props}
      />
    ),
    [collection?.id]
  )

  const pillWSv = useSharedValue(0)
  // Measured pill widths — populated by onCutoutSize after first render of each state.
  // recompute() uses these to start the spring synchronously (before React re-renders).
  const narrowWidthRef = useRef(0)
  const wideWidthRef = useRef(0)

  const shoulderCutout = useMemo<ShoulderCutoutDescriptor>(
    () => ({ pillWSv: pillWSv as SharedValue<number>, headerHeight: PILL_H, cornerR: PILL_R }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const cutoutContent = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {pendingRollback && (
        <>
          <TouchableOpacity
            onPress={() => pendingRollback.execute()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
          >
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.25)',
                borderRadius: 999,
                minWidth: 18,
                height: 18,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 13 }}>
                {pendingRollback.count}
              </Text>
            </View>
            <RotateCcw size={13} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={{ width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.3)' }} />
        </>
      )}
      {/* ✓ owns the back navigation — avoids the outer ShoulderCutout TouchableOpacity
          firing router.back() when the rollback button is pressed instead. */}
      <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
        <Check size={13} color="#fff" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  )

  const header = (
    <AppStandaloneHeader
      title="Add to collection"
      onBack={() => router.back()}
      cutout={{ onPress: () => {}, content: cutoutContent, pillWSv }}
      onCutoutSize={(w) => {
        pillWSv.value = w
        if (!pendingRollback) {
          narrowWidthRef.current = w
        } else {
          wideWidthRef.current = w
        }
      }}
    />
  )

  return (
    <View style={{ flex: 1 }}>
      <SearchScreen
        itemAccessories={itemAccessories}
        header={header}
        shoulderCutout={shoulderCutout}
        hide={() => router.back()}
      />
      {/* Off-screen pre-measurement: mirrors the wide cutoutContent so wideWidthRef is
          populated at mount, before the user makes any change. Eliminates the first-appearance
          layout-pass delay in recompute(). */}
      <View
        style={{ position: 'absolute', left: -10000, top: 0 }}
        pointerEvents="none"
        onLayout={(e) => {
          if (wideWidthRef.current === 0) {
            wideWidthRef.current = e.nativeEvent.layout.width + 32
          }
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View
              style={{
                minWidth: 18,
                height: 18,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', lineHeight: 13 }}>0</Text>
            </View>
            <RotateCcw size={13} color="#fff" strokeWidth={2.5} />
          </View>
          <View style={{ width: 1, height: 14 }} />
          <Check size={13} color="#fff" strokeWidth={2.5} />
        </View>
      </View>
    </View>
  )
}
