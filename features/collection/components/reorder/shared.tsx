// ITS-200: reorder mode for a collection's card list. Reordering happens in place: the
// collection page keeps its own list, each row's accessories (its copies) are dimmed with a drag
// icon on top, a short press anywhere on a row picks it up, and a bar above the list carries
// Cancel / Done.
//
// Design refs (Mobbin):
// - Apple Stocks, list edit mode: the same list switches into edit mode in place, with no
//   separate screen (https://mobbin.com/screens/51e453e0-8c20-4806-b55a-405c4623802a).
// - SiriusXM "Edit": Cancel / Save across the top and a "Press and drag an item to move it"
//   hint (https://mobbin.com/screens/cfb1e560-c6ae-4883-b6b9-47eff0ade897).
// - Behance "Reorder": the picked-up row lifts above its neighbours with a shadow while they
//   stay flat (https://mobbin.com/screens/7714843d-d1c0-4453-811d-4e0dcd8454bb).

import {
  CollectionItemSort,
  moveItem,
  useCollectionOrder,
  useReorderCollection,
} from '@/client/collections/order'
import { useToast } from '@/components/Toast'
import { Text } from '@/components/ui/text/base-text'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'

export type OrderRow = CollectionItemQueryView

/** panel-entry preset (CLAUDE.md): the reorder overlays reveal like a panel. */
export const OVERLAY_SPRING = { damping: 20, stiffness: 260, mass: 0.9 }
/** snap preset (CLAUDE.md): rows settling after a drag, no visible bounce. */
export const SNAP_SPRING = { damping: 100, stiffness: 300 }

/**
 * Reorder mode state: loads every card in the collection (the page itself only loads its first
 * page), keeps the working order, and saves it on Done.
 */
export function useReorderMode(
  collectionId: string | undefined,
  active: boolean,
  exit: () => void,
  /** The sort the page shows; reorder mode starts from that order. */
  sort: CollectionItemSort
) {
  const { data, isLoading, error } = useCollectionOrder(collectionId, active, sort)
  const [rows, setRows] = useState<OrderRow[] | null>(null)
  const { mutate: save } = useReorderCollection(collectionId)
  const { showToast } = useToast()

  // Take the server's order once per session; a refetch mid-drag mustn't reset the user's moves.
  useEffect(() => {
    setRows((prev) => (active ? (prev ?? data ?? null) : null))
  }, [active, data])

  // Starting from another sort, Done keeps what's on screen as the custom order even unmoved.
  const changed = useMemo(
    () =>
      !!data &&
      !!rows &&
      (sort !== 'custom' || rows.some((row, i) => row.ref_id !== data[i]?.ref_id)),
    [rows, data, sort]
  )

  const move = useCallback(
    (from: number, to: number) => setRows((prev) => (prev ? moveItem(prev, from, to) : prev)),
    []
  )

  const done = useCallback(() => {
    // Leave reorder mode right away; the list already shows the new order (optimistic) and
    // rolls back with a toast if the save fails.
    exit()
    if (!changed || !rows) return
    save(
      rows.map((r) => r.ref_id),
      {
        onError: (err) =>
          showToast({
            title: "Couldn't save the order",
            message:
              (err as { code?: string })?.code === '40001'
                ? 'The collection changed while you were reordering. Try again.'
                : 'Please try again.',
          }),
      }
    )
  }, [exit, changed, rows, save, showToast])

  return { rows, move, isLoading: active && isLoading, error, changed, done, cancel: exit }
}

/** Cancel / title / Done, shown above the list while reordering. */
export function ReorderBar({
  onCancel,
  onDone,
  changed,
  isLoading,
  error,
  sort,
}: {
  onCancel: () => void
  onDone: () => void
  changed: boolean
  isLoading: boolean
  error: unknown
  sort: CollectionItemSort
}) {
  return (
    <Animated.View
      entering={FadeInUp.duration(180)}
      exiting={FadeOutUp.duration(140)}
      style={[styles.bar, { borderBottomColor: Colors.rgba(Colors.$outlineNeutral, 0.4) }]}
    >
      <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button">
        <Text style={{ color: Colors.$textNeutral, fontSize: 16 }}>Cancel</Text>
      </Pressable>
      <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '600' }}>Reorder cards</Text>
        {isLoading ? (
          <ActivityIndicator size="small" color={Colors.$textNeutral} />
        ) : (
          <Text
            variant="small"
            numberOfLines={1}
            style={{ color: error ? Colors.$textDanger : Colors.$textNeutral, fontSize: 11 }}
          >
            {error
              ? "Couldn't load every card. Try again."
              : sort === 'custom'
                ? 'Hold a card, then drag. New cards appear at the top.'
                : 'Starting from the current sort. Done saves it as your custom order.'}
          </Text>
        )}
      </View>
      <Pressable onPress={onDone} hitSlop={8} accessibilityRole="button">
        <Text
          style={{
            color: changed ? Colors.$textPrimary : Colors.$textDefault,
            fontSize: 16,
            fontWeight: '600',
          }}
        >
          Done
        </Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
})
