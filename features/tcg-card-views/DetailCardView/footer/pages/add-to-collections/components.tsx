import { useViewCollectionItemsForCard } from '@/client/collections/query'
import { CollectionItem, CollectionLike, EditCollectionArgsItem } from '@/client/collections/types'
import {
  CollectionItemEntry,
  PriceChangeModal,
  PriceModalPayload,
  VariantsSelect,
} from '@/components/collections/items/editable-entry-item'
import { Spinner } from '@/components/ui/spinner'
import { TCard } from '@/constants/types'
import { CollectionItemRow } from '@/lib/store/functions/types'
import { Plus, TriangleAlert, Undo2 } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'

import { useGradingConditions } from '@/client/card/grading'
import { Button } from '@/components/ui/button'
import { getContentInsets, Modal } from '@/components/ui/modal'
import {
  NativeSelectScrollView,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { sortCollectionItem } from '@/features/tcg-card-views/helpers'
import { qk } from '@/lib/store/functions/helpers'
import { InfiniteData, useQueryClient } from '@tanstack/react-query'
import Animated, { LinearTransition } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { v4 as uuidv4 } from 'uuid'
// import { Label } from '@react-navigation/elements'

export const CollectionCardItemEntries = ({
  collection,
  isShown,
  card,
  style,
  editable,
  isLoading: isLoadingOuter,
}: {
  collection: CollectionLike
  isShown: boolean
  card: TCard
  style?: StyleProp<ViewStyle>
  editable?: boolean
  isLoading?: boolean
}) => {
  const {
    data: loadedEntries,
    isLoading,
    refetch,
  } = useViewCollectionItemsForCard(collection?.id, card?.id, isShown)

  const qc = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [priceChangeEntry, setPriceChangeEntry] = useState<PriceModalPayload | null>(null)
  const handleDismiss = useCallback(() => {
    setShowModal(false)
  }, [refetch])

  const sortedEntries = useMemo(() => {
    const hasItems = loadedEntries.some((e) => e.quantity >= 1)
    const baseEntries = hasItems ? loadedEntries : [{ quantity: 0 }, ...loadedEntries]

    const sortedEntries = [...baseEntries].sort(sortCollectionItem)
    return sortedEntries
  }, [loadedEntries])

  return (
    <View
      style={[
        style,
        {
          paddingRight: editable ? 0 : 12,
          display: 'flex',
          flexDirection: 'column',
          alignSelf: 'stretch',
        },
      ]}
    >
      {isLoading || card === null ? (
        <Spinner />
      ) : (
        <View style={{ width: '100%' }}>
          {sortedEntries.map((entry, index) => (
            <Animated.View
              key={entry.id ?? entry.grade_condition_id ?? `${index}-new`}
              layout={LinearTransition}
            >
              <CollectionItemEntry
                card={card}
                collectionItem={entry}
                collection={collection}
                editable={editable}
                isLoading={isLoadingOuter}
                onPriceModalOpen={(data) => setPriceChangeEntry(data)}
                onDelete={() => {
                  qc.invalidateQueries({
                    queryKey: [
                      ...qk.collectionItems(collection?.id),
                      ...(card?.id ? ['cardId', card?.id] : []),
                    ],
                  })
                  if (card?.id) {
                    qc.invalidateQueries({ queryKey: qk.collectionForCard(card.id) })
                  }
                  if (loadedEntries.length <= 1 && card?.id && collection?.id) {
                    qc.setQueriesData<InfiniteData<{ ref_id: string }[]>>(
                      { queryKey: [...qk.collectionItems(collection.id), 'infinite'] },
                      (prev) => {
                        if (!prev) return prev
                        return {
                          ...prev,
                          pages: prev.pages.map((page) =>
                            page.filter((item) => item.ref_id !== card.id)
                          ),
                        }
                      }
                    )
                  }
                }}
              />
            </Animated.View>
          ))}
        </View>
      )}

      <Button
        variant={'primary'}
        disabled={isLoadingOuter}
        style={{
          flexGrow: 0,
          alignSelf: 'flex-end',
          marginTop: 8,
          width: 94,
          height: 34,
          marginRight: 36 + (editable ? 24 : 0),
          opacity: isLoadingOuter ? 0.5 : 1,
          borderRadius: 9999,
        }}
        onPress={() => {
          setShowModal(true)
          // setNewEntries((prev) => [...prev, {}])
        }}
      >
        <Plus color={Colors.$iconDefault} />
        <Text variant="large" style={{ color: Colors.$iconDefault, lineHeight: 0 }}>
          Add
        </Text>
      </Button>
      {collection && (
        <AddVariantModal
          entries={sortedEntries}
          collection={collection}
          item={card}
          visible={showModal}
          onDismiss={handleDismiss}
        />
      )}
      <PriceChangeModal
        cardData={card}
        visible={!!priceChangeEntry}
        onDismiss={() => setPriceChangeEntry(null)}
        data={priceChangeEntry}
      />
    </View>
  )
}

const AddVariantModal = ({
  collection,
  item,
  visible,
  onDismiss,
  entries,
}: {
  entries: Partial<CollectionItemRow>[]
  collection: CollectionLike
  item: TCard
  visible: boolean
  onDismiss: () => void
}) => {
  const qc = useQueryClient()
  const { data: gradeData, error } = useGradingConditions()

  const insets = useSafeAreaInsets()
  const contentInsets = getContentInsets(insets)

  const [saving, setSaving] = useState(false)

  const initialDraft = useMemo<EditCollectionArgsItem>(() => {
    return {
      ref_id: item?.id,
      quantity: 0,
      grading_company: null,
      grade_condition_id: null,
      collection_id: collection?.id,
      item_kind: 'card',
    }
  }, [item?.id, gradeData])

  const [draft, setDraft] = useState<EditCollectionArgsItem>(initialDraft)

  useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  const collectionItemsKey = useMemo(
    () => [...qk.collectionItems(collection?.id), 'cardId', item?.id],
    [collection?.id, item?.id]
  )

  const company = useMemo(
    () => gradeData?.find((c) => c.slug === draft.grading_company),
    [draft, gradeData]
  )
  const gradeIdx = useMemo(
    () => company?.grades.findIndex((g) => g.id === draft.grade_condition_id),
    [company, draft]
  )

  const isComplete = (draft: EditCollectionArgsItem) =>
    Boolean(draft.grading_company && draft.grade_condition_id)

  const isEqualToInitial = (draft: EditCollectionArgsItem) =>
    draft.quantity === initialDraft.quantity &&
    draft.grading_company === initialDraft.grading_company &&
    draft.grade_condition_id === initialDraft.grade_condition_id

  const variantsEqual = (a?: string[] | null, b?: string[] | null) => {
    const aVariants = a ?? []
    const bVariants = b ?? []
    if (aVariants.length !== bVariants.length) return false
    return aVariants.every((variant, idx) => variant === bVariants[idx])
  }

  const alreadyExists = useCallback(
    (incoming: EditCollectionArgsItem) => {
      const currentEntries =
        qc.getQueryData<Partial<CollectionItem>[]>(collectionItemsKey) ?? entries ?? []
      return currentEntries.some(
        (e) =>
          e.grade_condition_id === incoming.grade_condition_id &&
          variantsEqual(
            e.variants as string[] | undefined,
            incoming.variants as string[] | undefined
          )
      )
    },
    [collectionItemsKey, entries, qc]
  )

  const enableSave = useMemo(() => {
    return !(!isComplete(draft) || isEqualToInitial(draft) || alreadyExists(draft))
  }, [alreadyExists, draft])

  const updateDraft = (patch: Partial<typeof initialDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const defaultGrader = gradeData?.find((grader) => grader.name.toLocaleLowerCase() === 'psa')

  return (
    <Modal visible={visible} onDismiss={onDismiss}>
      <View className="flex flex-col gap-4 py-4 w-full">
        <View className="flex flex-row gap-4 w-full">
          <Select
            defaultValue={
              defaultGrader
                ? {
                    value: defaultGrader?.id,
                    label: defaultGrader?.slug.toLocaleLowerCase(),
                  }
                : undefined
            }
            value={
              company
                ? {
                    value: company.id,
                    label: company.slug.toLocaleUpperCase(),
                  }
                : undefined
            }
            onValueChange={(option) => {
              const company = gradeData?.find((c) => c.id === option?.value)
              updateDraft({
                grading_company: company?.slug ?? null,
                // reset condition when company changes
                grade_condition_id: null,
              })
            }}
            style={{
              flex: 1.0,
            }}
          >
            <SelectTrigger label="Format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent insets={contentInsets} side="top" sideOffset={12}>
              <SelectGroup>
                {gradeData?.map((gradingCompany) => (
                  <SelectItem
                    groupItem
                    key={gradingCompany.id}
                    label={gradingCompany.slug.toLocaleUpperCase()}
                    value={gradingCompany.id}
                  >
                    {gradingCompany.slug}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            onOpenChange={(open) => {
              if (!draft.grading_company) return
            }}
            style={{
              flex: 1,
            }}
            disabled={!draft.grading_company}
            value={
              gradeIdx !== undefined && gradeIdx >= 0 && company?.grades[gradeIdx]
                ? {
                    value: String(gradeIdx),
                    label: String(company.grades[gradeIdx].grade_value),
                  }
                : undefined
            }
            onValueChange={(option) => {
              const gradeIdx = Number(option?.value)
              if (isFinite(gradeIdx)) {
                const grade = company?.grades[gradeIdx]
                const grade_condition = {
                  ...grade,
                  company_id: company?.id,
                }
                updateDraft({ grade_condition_id: grade?.id, grade_condition })
              }
            }}
          >
            <SelectTrigger label="Condition" disabled={!draft.grading_company}>
              <SelectValue>
                <View
                  style={{
                    flex: 1,
                    justifyContent: 'flex-end',
                    alignContent: 'flex-end',
                  }}
                >
                  {company && draft.grade_condition && (
                    <Text style={{ textAlign: 'right' }}>
                      {formatPrice(
                        item.grades_prices[`${company.slug}${draft.grade_condition?.grade_value}`]
                      )}
                    </Text>
                  )}
                </View>
              </SelectValue>
            </SelectTrigger>
            <SelectContent insets={contentInsets} side="top" sideOffset={12}>
              <NativeSelectScrollView>
                <SelectGroup>
                  {company?.grades.map((grade, index) => (
                    <SelectItem
                      key={`${grade.id}-${grade.grade_value}`}
                      label={`${grade.grade_value}`}
                      value={String(index)}
                      groupItem
                    >
                      <View
                        style={{
                          flex: 1,
                          justifyContent: 'flex-end',
                          alignContent: 'flex-end',
                        }}
                      >
                        <Text style={{ textAlign: 'right' }}>
                          {formatPrice(item.grades_prices[`${company.slug}${grade.grade_value}`])}
                        </Text>
                      </View>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </NativeSelectScrollView>
            </SelectContent>
          </Select>
        </View>

        <View className="flex-col grow-0 shrink">
          <VariantsSelect
            card={item}
            inputProps={{
              onItemsChange: (items) => {
                updateDraft({
                  variants: items.map((i) => i.name),
                })
              },
            }}
          />
        </View>
        {alreadyExists(draft) && draft.grade_condition_id && (
          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginTop: 4,
            }}
          >
            <TriangleAlert size={20} color={Colors.$textDanger} />
            <Text style={{ color: Colors.$textDanger }}>{'Collection type already exists.'}</Text>
          </View>
        )}
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
          }}
        >
          <Button
            size="lg"
            style={{
              flex: 1,
            }}
            variant="default"
            onPress={() => {
              onDismiss()
            }}
          >
            <Undo2 size={24} color={Colors.$iconDefault} />
            <Text variant={'large'}>Back</Text>
          </Button>
          <Button
            style={{
              flex: 1,
            }}
            disabled={!enableSave}
            size="lg"
            variant="primary"
            onPress={() => {
              setSaving(true)
              if (collection.id) {
                qc.setQueryData<Partial<CollectionItem>[]>(collectionItemsKey, (prev) => {
                  const current = prev ?? []
                  const exists = current.some(
                    (e) =>
                      e.grade_condition_id === draft.grade_condition_id &&
                      variantsEqual(
                        e.variants as string[] | undefined,
                        draft.variants as string[] | undefined
                      )
                  )
                  if (exists) return current
                  return [...current, { id: uuidv4(), ...draft }]
                })
              }
              setSaving(false)
              onDismiss()
            }}
          >
            {saving ? (
              <Spinner color={Colors.$textDefaultLight} />
            ) : (
              <Plus size={24} color={Colors.$iconDefault} />
            )}
            <Text variant={'large'}>Add</Text>
          </Button>
        </View>
      </View>
    </Modal>
  )
}
