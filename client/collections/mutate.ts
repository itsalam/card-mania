import { prewarmPriceHistory } from '@/client/chart-data'
import { gradingConditionsKeys, Graders } from '@/client/card/grading'
import { TCard, TCollection, TTag } from '@/constants/types'
import { getGradedPrice } from '@/components/tcg-card/helpers'
import { getSupabase } from '@/lib/store/client'
import { qk, requireUser } from '@/lib/store/functions/helpers'
import { CollectionRow } from '@/lib/store/functions/types'
import { useUserStore } from '@/lib/store/useUserStore'
import { reportError } from '@/lib/utils/report-error'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CollectionItem,
  EditCollectionArgs,
  EditCollectionArgsItem,
  EditCollectionResult,
  InsertCollection,
  InsertCollectionTag,
  UpdateCollection,
} from './types'

const mutateCollectionFn =
  (collectionData: Partial<TCollection> | null) => async (args: EditCollectionArgs) => {
    // 1) Create or update the collection
    let collectionId = args.id || collectionData?.id
    let collection: CollectionRow
    if (!collectionData) {
      const user = await requireUser()
      const upsertData: InsertCollection = {
        name: args.name,
        user_id: user.id,
        description: args.description ?? null,
        visibility: args.visibility,
        cover_image_url: args.cover_image_url ?? null,
        is_storefront: args.is_storefront,
        hide_sold_items: args.hide_sold_items,
      }
      const { data, error } = await getSupabase()
        .from('collections')
        .upsert(upsertData)
        .select()
        .single()

      if (error || !data) {
        throw error ?? new Error('No collection returned from upsert')
      }
      collection = data as CollectionRow
      collectionId = collection.id
    } else if (collectionData.id) {
      const updateData: Partial<UpdateCollection> = {
        name: args.name,
        description: args.description ?? null,
        visibility: args.visibility,
        cover_image_url: args.cover_image_url ?? null,
        is_storefront: args.is_storefront,
        hide_sold_items: args.hide_sold_items,
      }

      const { data, error } = await getSupabase()
        .from('collections')
        .update(updateData)
        .eq('id', collectionData.id)
        .select()
        .single()

      if (error || !data) {
        throw error ?? new Error('No collection returned from update')
      }
      collection = data as CollectionRow
      collectionId = collection?.id
    }

    collectionId = collectionData?.id || collectionId!

    let addedTagIds: string[] = []
    let deletedTagIds: string[] = []

    if (args.tags && collectionId) {
      // get current tags
      const { data: existingRows, error: existingErr } = await getSupabase()
        .from('collection_tags')
        .select('tag_id')
        .eq('collection_id', collectionId)

      if (existingErr) throw existingErr

      const existing = new Set((existingRows ?? []).map((r) => r.tag_id as string))
      const desired = new Set(args.tags)

      deletedTagIds = [...existing].filter((id) => !desired.has(id))
      addedTagIds = [...desired].filter((id) => !existing.has(id))

      if (deletedTagIds.length) {
        const { error } = await getSupabase()
          .from('collection_tags')
          .delete()
          .eq('collection_id', collectionId)
          .in('tag_id', deletedTagIds)
        if (error) throw error
      }

      if (addedTagIds.length) {
        const user = await requireUser() // only when we actually need it
        const insertData: InsertCollectionTag[] = addedTagIds.map((tag_id) => ({
          collection_id: collectionId!,
          tag_id,
          user_id: user.id,
        }))
        const { error } = await getSupabase().from('collection_tags').insert(insertData)
        if (error) throw error
      }
    }

    // 3) Return a stable, well-defined shape
    return {
      collection: collection!,
      addedTagIds,
      deletedTagIds,
    } as EditCollectionResult
  }

export const useEditCollection = (collectionId?: string) => {
  const qc = useQueryClient()
  const collectionData = qc.getQueryData([...qk.collections, collectionId]) as
    | TCollection
    | undefined

  const collectionTagData = qc.getQueryData([...qk.collections, collectionId, 'tags']) as
    | TTag['id'][]
    | undefined

  return useMutation({
    mutationFn: mutateCollectionFn(collectionData ?? null),
    onMutate: async (patch) => {
      if (collectionData) {
        await qc.cancelQueries({
          queryKey: [...qk.userCollections, collectionId],
        })
      }

      const prevCollection = qc.getQueryData<TCollection>([...qk.userCollections, collectionId])

      // Optimistically apply patch to detail
      if (prevCollection) {
        qc.setQueryData<TCollection>([...qk.userCollections, collectionId], {
          ...prevCollection,
          ...patch,
        })
      }

      return { prev: prevCollection }
    },

    onError: (err, vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData([...qk.userCollections, ctx.prev.id], ctx.prev)
      }
      reportError({ context: 'useEditCollection', error: err, metadata: { vars, collectionId } })
    },
    onSettled: (_data, _err, vars) => {
      // Revalidate to ensure canonical server state
      const collection = _data?.collection
      qc.setQueryData([...qk.userCollections, vars.id], _data?.collection)
      const collectionTags = collectionTagData ?? []
      const updatedTags = collectionTags
        .filter(
          (tagId) => _data?.deletedTagIds.includes(tagId) || _data?.addedTagIds.includes(tagId)
        )
        .concat(_data?.addedTagIds ?? [])
      if (collection) {
        qc.setQueryData([...qk.userCollections, collectionId, 'tags'], updatedTags)
      }
    },
  })
}

const mutateCollectionItemFn =
  (itemData: CollectionItem) =>
  async (args: { delete?: boolean; item: EditCollectionArgsItem; card?: TCard }) => {
    const { delete: deleteRecord, item, card } = args
    const user = await requireUser()
    const { grade_condition, ...parsedItem } = { ...itemData, ...item }
    const fullArgs = {
      ...parsedItem,
      user_id: item.user_id ?? user.id,
    }
    if (fullArgs.id && (deleteRecord || fullArgs.quantity === 0)) {
      const { error } = await getSupabase().from('collection_items').delete().eq('id', fullArgs.id)
      if (error) throw error
      return fullArgs as CollectionItem
    }
    const { id, collection_id } = fullArgs
    if (id && collection_id) {
      const { data, error } = await getSupabase()
        .from('collection_items')
        .upsert({ ...fullArgs, id, collection_id })
        .select()
        .single()
      if (error) throw error
      return data as CollectionItem
    }
    if (!id && collection_id && fullArgs.ref_id && (fullArgs.quantity ?? 0) > 0) {
      if (card?.id) {
        await getSupabase().rpc('ensure_card_stub', {
          p_id: card.id as any,
          p_name: card.name ?? '',
          p_set_name: card.set_name ?? '',
          p_genre: (card.genre ?? 'trading_card') as any,
          p_grades_prices: (card.grades_prices ?? {}) as any,
          p_latest_price: card.latest_price ?? null,
          p_image_url: card.image?.url ?? null,
        })
      }
      const { data, error } = await getSupabase()
        .from('collection_items')
        .insert({ ...fullArgs, collection_id, item_kind: fullArgs.item_kind ?? 'card' })
        .select()
        .single()
      if (error) throw error
      return data as CollectionItem
    }
  }

export const useEditCollectionItem = (collectionId?: string, cardId?: string, itemId?: string) => {
  const user = useUserStore((s) => s.user)
  const qc = useQueryClient()

  const queryKey = [
    ...qk.collectionItems(collectionId),
    ...(cardId ? ['cardId', cardId] : []),
  ] as const

  const totalsKey = [...qk.collections, collectionId, 'totals'] as const

  const items = qc.getQueryData<(CollectionItem & EditCollectionArgsItem)[]>(queryKey)

  const baseItem: CollectionItem | undefined = items?.find((it) => it.id === itemId)

  const id = Boolean(itemId?.includes('temp')) ? undefined : itemId

  return useMutation<
    CollectionItem | undefined,
    unknown,
    { item: EditCollectionArgsItem; delete?: boolean; card?: TCard },
    {
      prevItems: (CollectionItem & EditCollectionArgsItem)[] | undefined
      prevTotal: number | undefined
    }
  >({
    mutationFn: mutateCollectionItemFn({
      user_id: user?.id,
      ...baseItem,
      id,
    } as CollectionItem),
    onMutate: async (vars) => {
      const { delete: deleteItem, item } = vars
      await qc.cancelQueries({ queryKey })
      await qc.cancelQueries({ queryKey: totalsKey })

      if (deleteItem && items) {
        qc.setQueryData(queryKey, [...items.filter((pi) => pi.id !== item.id)])
      }

      const prevTotal = qc.getQueryData<number>(totalsKey)

      // Optimistically adjust collection total using cached card + grading data
      if (prevTotal !== undefined) {
        const refId = baseItem?.ref_id ?? item.ref_id
        const card = refId ? qc.getQueryData<TCard>(qk.card(refId)) : undefined
        const graders = qc.getQueryData<Graders[]>(gradingConditionsKeys.all)

        if (card && graders) {
          const priceOf = (gradeId: string | null | undefined, qty: number) =>
            (getGradedPrice({ card, graders, gradeId: gradeId ?? undefined }) ?? 0) * qty

          const before = baseItem ? priceOf(baseItem.grade_condition_id, baseItem.quantity ?? 0) : 0
          const after = deleteItem ? 0 : priceOf(item.grade_condition_id, item.quantity ?? 0)
          const delta = after - before

          if (delta !== 0) {
            qc.setQueryData<number>(totalsKey, prevTotal + delta)
          }
        }
      }

      return { prevItems: items, prevTotal }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prevItems) {
        qc.setQueryData(queryKey, ctx.prevItems)
      }
      if (ctx?.prevTotal !== undefined) {
        qc.setQueryData(totalsKey, ctx.prevTotal)
      }
      reportError({
        context: 'useEditCollectionItem',
        error: err,
        metadata: { vars, collectionId, cardId, itemId },
      })
    },
    onSuccess: (data, vars, ctx) => {
      const deleteItem = vars.delete
      const prevItems = ctx.prevItems
      if (data && deleteItem && prevItems) {
        qc.setQueryData(queryKey, [
          ...prevItems.filter((pi) => pi.id !== `temp-${data.grade_condition_id}`),
        ])
      }

      if (!deleteItem && data?.ref_id) {
        const card = qc.getQueryData<TCard>(qk.card(data.ref_id))
        const gradesPrices = card?.grades_prices as Record<string, number> | undefined
        const grades = gradesPrices ? Object.keys(gradesPrices) : []
        if (grades.length) prewarmPriceHistory(data.ref_id, grades)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: qk.collectionItems(collectionId) })
      qc.invalidateQueries({ queryKey: totalsKey })
    },
  })
}

// Delete a collection and clean related cache
export const useDeleteCollection = () => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (collectionId: string) => {
      await requireUser()
      const { data, error } = await getSupabase()
        .from('collections')
        .delete()
        .eq('id', collectionId)
        .select()
        .single()
      if (error) throw error
      return data as CollectionRow
    },
    onMutate: async (collectionId) => {
      await qc.cancelQueries({ queryKey: [...qk.userCollections] })
      const prevList = qc.getQueryData<CollectionRow[]>([...qk.userCollections])

      if (prevList) {
        qc.setQueryData(
          [...qk.userCollections],
          prevList.filter((c) => c.id !== collectionId)
        )
      }

      return { prevList }
    },
    onError: (_err, collectionId, ctx) => {
      if (ctx?.prevList) {
        qc.setQueryData([...qk.userCollections], ctx.prevList)
      }
      reportError({ context: 'useDeleteCollection', error: _err, metadata: { collectionId } })
    },
    onSettled: (_data, _err, collectionId) => {
      qc.invalidateQueries({ queryKey: [...qk.userCollections] })
      qc.removeQueries({
        queryKey: [...qk.collectionItems(collectionId)],
      })
      qc.removeQueries({ queryKey: [...qk.collections, collectionId] })
    },
  })
}
