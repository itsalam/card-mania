// ITS-200: shared pieces of the Reorder sheet (native drag list and web fallback).
//
// Design refs (Mobbin): Spotify "Edit playlist", with Cancel / Save in the header and
// thumbnail rows with a drag handle on the right
// (https://mobbin.com/screens/e0486c16-d841-442f-8172-e020cf712e19); Waking Up "Edit Playlist",
// the same layout with a two-line title / subtitle per row
// (https://mobbin.com/screens/5f74befd-72a9-408f-985f-cedbc55649b2).

import { useCollectionOrder, useReorderCollection } from '@/client/collections/order'
import { useToast } from '@/components/Toast'
import { Text } from '@/components/ui/text/base-text'
import { TCard } from '@/constants/types'
import { CardImage } from '@/features/tcg-card-views/card-image'
import { getCardDisplayData } from '@/features/tcg-card-views/helpers'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { getGradingDisplayString } from '../../helpers'

export type OrderRow = CollectionItemQueryView

export type ReorderSheetProps = {
  collectionId: string
  visible: boolean
  onClose: () => void
}

/** Loads the current order, keeps the working copy, and saves it on Done. */
export function useReorderSheetState({ collectionId, visible, onClose }: ReorderSheetProps) {
  const { data, isLoading, error } = useCollectionOrder(collectionId, visible)
  const [rows, setRows] = useState<OrderRow[]>([])
  const { mutate: save } = useReorderCollection(collectionId)
  const { showToast } = useToast()

  useEffect(() => {
    if (visible && data) setRows(data)
  }, [visible, data])

  const changed = useMemo(
    () => !!data && rows.some((row, i) => row.ref_id !== data[i]?.ref_id),
    [rows, data]
  )

  const done = () => {
    // Close right away; the list already shows the new order (optimistic) and rolls back
    // with a toast if the save fails.
    onClose()
    if (!changed) return
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
  }

  return { rows, setRows, isLoading, error, changed, done }
}

export function ReorderHeader({
  onCancel,
  onDone,
  changed,
}: {
  onCancel: () => void
  onDone: () => void
  changed: boolean
}) {
  return (
    <View style={[styles.header, { borderBottomColor: Colors.rgba(Colors.$outlineNeutral, 0.4) }]}>
      <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button">
        <Text style={{ color: Colors.$textNeutral, fontSize: 16 }}>Cancel</Text>
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: '600' }}>Reorder cards</Text>
        <Text variant="small" style={{ color: Colors.$textNeutral, fontSize: 11 }}>
          New cards appear at the top
        </Text>
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
    </View>
  )
}

export function ReorderRowContent({ row, trailing }: { row: OrderRow; trailing: ReactNode }) {
  const card = { ...row, id: row.id ?? row.ref_id } as unknown as TCard
  const displayData = getCardDisplayData({
    card,
    collectionItem: { ...row, id: row.collection_item_id } as any,
  })
  const grade = getGradingDisplayString({ ...row, id: row.collection_item_id } as any)
    .slice(0, 2)
    .join(' ')

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: Colors.$backgroundElevated,
          borderBottomColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
        },
      ]}
    >
      <CardImage displayData={displayData} width={36} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600' }}>
          {row.name ?? 'Unknown card'}
        </Text>
        <Text
          numberOfLines={1}
          variant="small"
          style={{ color: Colors.$textNeutral, fontSize: 12 }}
        >
          {[row.set_name, grade].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {trailing}
    </View>
  )
}

export function ReorderStatus({
  isLoading,
  error,
  empty,
}: {
  isLoading: boolean
  error: unknown
  empty: boolean
}) {
  if (isLoading) {
    return (
      <View style={styles.status}>
        <ActivityIndicator color={Colors.$textNeutral} />
      </View>
    )
  }
  if (error || empty) {
    return (
      <View style={styles.status}>
        <Text style={{ color: Colors.$textNeutral, textAlign: 'center' }}>
          {error ? "Couldn't load this collection. Try again." : 'No cards to reorder yet.'}
        </Text>
      </View>
    )
  }
  return null
}

export const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  handle: {
    padding: 8,
    marginRight: -8,
  },
  status: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
})
