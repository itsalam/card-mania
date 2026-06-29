import { useCardQuery } from '@/client/card'
import { Graders, useGradingConditions } from '@/client/card/grading'
import { suggestedVariantsOptions, Variant } from '@/client/collections/items'

import { useEditCollectionItem } from '@/client/collections/mutate'
import { CollectionItem, CollectionLike, EditCollectionArgsItem } from '@/client/collections/types'
import { getGradedPrice } from '@/components/tcg-card/helpers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/input/base-input'
import { useInputColors } from '@/components/ui/input/provider'
import { styles } from '@/components/ui/input/styles'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import {
  MultiChipInput,
  MultiChipInputProps,
} from '@/components/ui/multi-select-input/multi-select-input'
import { NumberTicker } from '@/components/ui/number-ticker'
import { Separator } from '@/components/ui/separator'
import { SkeletonText, Text } from '@/components/ui/text'
import { formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { getGradingDisplayString } from '@/features/collection/helpers'
import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { qk } from '@/lib/store/functions/helpers'
import { CollectionItemRow } from '@/lib/store/functions/types'
import { useQueryClient } from '@tanstack/react-query'
import { debounce } from 'lodash'
import {
  Check,
  DollarSign,
  EllipsisVertical,
  GripVertical,
  Tag,
  Trash2,
  X,
} from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import ReanimatedSwipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable'
import Animated, { FadeOutRight, SharedValue } from 'react-native-reanimated'
import { Colors, TouchableOpacity, Typography } from 'react-native-ui-lib'

const ATag = Animated.createAnimatedComponent(Tag)

const AccessoryTag = ({ size = 24 }: { size?: number }) => {
  const { color } = useInputColors()
  //@ts-ignore
  return <ATag size={size} color={color} />
}

export const VariantsSelect = ({
  card,
  inputProps = {},
}: {
  card: TCard
  onChange?: () => {}
  inputProps?: Partial<MultiChipInputProps<Partial<Variant> & Pick<Variant, 'id' | 'name'>>>
}) => {
  const qc = useQueryClient()

  const fetchSuggestions = useCallback(
    (q?: string) => {
      const search = (q ?? '').trim()
      if (!card?.id) return Promise.resolve([])
      return qc
        .fetchQuery(suggestedVariantsOptions({ cardId: card?.id, search }))
        .then((allTags) => {
          return allTags
        })
    },
    [qc]
  )

  return (
    <MultiChipInput<Partial<Variant> & Pick<Variant, 'id' | 'name'>>
      leadingAccessory={<AccessoryTag />}
      placeholder={'Variants'}
      floatingPlaceholder
      fetchSuggestions={fetchSuggestions}
      extractCat={() => 'general'}
      unique
      {...inputProps}
    />
  )
}

export type PriceModalPayload = {
  draft: EditCollectionArgsItem
  updateDraft: (patch: Partial<EditCollectionArgsItem>) => void
  onDelete: () => void
  price: number | null
  currentGrade: { grade_value: number; label: string; id: string } | undefined
  currentGrader: Graders | undefined
}

export const CollectionItemEntry = ({
  collection,
  collectionItem,
  onDelete,
  card,
  editable,
  isLoading,
  onPriceModalOpen,
  showDelete,
}: {
  showDelete: boolean
  collection?: CollectionLike
  collectionItem?: Partial<CollectionItemRow>
  onDelete?: () => void
  card: TCard | null
  editable?: boolean
  isLoading?: boolean
  onPriceModalOpen?: (data: PriceModalPayload) => void
}) => {
  const { data: gradeData, error } = useGradingConditions()
  const [hide, setHide] = useState(false)
  const qc = useQueryClient()

  const editableItem = useEditCollectionItem(
    collectionItem?.collection_id || collection?.id,
    card?.id,
    collectionItem?.id
  )

  const { data: cardData } = useCardQuery(card?.id)

  const initialDraft = useMemo(() => {
    const gradeFormat = gradeData?.find((c) => c.slug === collectionItem?.grading_company)
    const grade =
      currentGrade ?? gradeFormat?.grades.find((g) => g.id === collectionItem?.grade_condition_id)

    return {
      collection_id: collection?.id,
      ref_id: card?.id,
      quantity: collectionItem?.quantity ?? 0,
      grading_company: gradeFormat?.slug ?? null,
      grade_condition_id: collectionItem?.grade_condition?.id ?? grade?.id ?? null,
      item_kind: 'card' as const,
    }
  }, [collection?.id, card?.id, collectionItem, gradeData])

  const [draft, setDraft] = useState<EditCollectionArgsItem>(initialDraft)

  const currentGrader = useMemo(() => {
    if (!gradeData || !collectionItem?.grade_condition_id) return undefined
    const gradingCompany = gradeData.find((gd) =>
      gd.grades.some((grade) => grade.id === collectionItem.grade_condition_id)
    )

    return gradingCompany
  }, [gradeData, collectionItem?.grade_condition_id])

  const currentGrade = useMemo(() => {
    return currentGrader?.grades.find((grade) => grade.id === collectionItem?.grade_condition_id)
  }, [currentGrader])

  // Refs so the stable debounce below always calls the latest logic without
  // being recreated (useMutation returns a new object reference every render,
  // which was causing a new debounce instance per render — old timers were
  // never cancelled, firing stale INSERTs and producing duplicate rows).
  const editableItemRef = useRef(editableItem)
  editableItemRef.current = editableItem
  const cardRef = useRef(card)
  cardRef.current = card
  const initialDraftRef = useRef(initialDraft)
  initialDraftRef.current = initialDraft
  // Tracks the most-recently committed draft so the debounce can detect a rollback.
  // Updated synchronously at every setDraft call site (not via useEffect) so it is
  // always current by the time the 1000ms debounce fires.
  const draftRef = useRef(draft)

  useEffect(() => {
    setDraft(initialDraft)
    draftRef.current = initialDraft
  }, [initialDraft])

  // Created once — never recreated, so its internal timer is always the same.
  const mutateDebounce = useMemo(
    () =>
      debounce((draft: EditCollectionArgsItem, patch: Partial<EditCollectionArgsItem>) => {
        const merged = { ...draft, ...patch }
        const id = initialDraftRef.current
        if (
          merged.quantity === id.quantity &&
          merged.grading_company === id.grading_company &&
          merged.grade_condition_id === id.grade_condition_id
        )
          return
        // If the component was reset (e.g., rollback) while this debounce was pending,
        // draftRef.current will no longer match the captured merged values — skip the
        // server write to prevent the rolled-back cache from being overwritten.
        const cur = draftRef.current
        if (
          cur.quantity !== merged.quantity ||
          cur.grade_condition_id !== merged.grade_condition_id ||
          cur.grading_company !== merged.grading_company
        )
          return
        editableItemRef.current.mutate(
          { item: merged, card: cardRef.current ?? undefined },
          {
            onSuccess: (res) => {
              if (res) setDraft(res as EditCollectionArgsItem)
            },
            onError: (...e) => {
              console.error({ e })
              setHide(false)
              setDraft(draft)
            },
          }
        )
      }, 1000),
    [] // intentionally empty — stable for component lifetime
  )

  const deleteEntry = useCallback(
    (draft: EditCollectionArgsItem) => {
      mutateDebounce.cancel()
      editableItemRef.current.mutate(
        { delete: true, item: { ...draft, quantity: 0 } },
        {
          onSettled: () => {
            setHide(true)
            onDelete?.()
          },
          onError: (a) => console.log(a),
        }
      )
    },
    [mutateDebounce, onDelete]
  )

  const updateDraft = (patch: Partial<typeof initialDraft>) => {
    if (patch.quantity === 0 && (draft.quantity ?? 0) > 0) {
      deleteEntry(draft)
    } else {
      setDraft((prev) => ({ ...prev, ...patch }))
      draftRef.current = { ...draftRef.current, ...patch }

      // Immediately reflect the patch in the query cache so that add-card.tsx's
      // cache subscriber detects the change without waiting for the 1000ms debounce
      // + server round-trip. The debounced mutate still handles persistence.
      const itemCollectionId = collectionItem?.collection_id || collection?.id
      if (itemCollectionId && card?.id && collectionItem?.id) {
        qc.setQueryData<CollectionItem[]>(
          [...qk.collectionItems(itemCollectionId), 'cardId', card.id],
          (prev) =>
            prev?.map((item) =>
              item.id === collectionItem.id ? ({ ...item, ...patch } as CollectionItem) : item
            ) ?? prev
        )
      }

      mutateDebounce(draft, patch)
    }
  }

  const price = useMemo(() => {
    const cardForPrice = card ?? cardData
    if (cardForPrice && gradeData) {
      return getGradedPrice({ card: cardForPrice, graders: gradeData, gradeId: currentGrade?.id })
    } else return null
  }, [card, cardData, gradeData, currentGrade])
  const scheme = useEffectiveColorScheme() // 'light' | 'dark' | null
  const swipeableRef = useRef<SwipeableMethods>(null)
  //TODO: Implement modal overriwte/selling options

  const renderRightActions = useCallback(
    (_progress: SharedValue<number>, _translation: SharedValue<number>) => (
      <View style={{ flexDirection: 'row', marginLeft: 12 }}>
        <TouchableOpacity
          onPress={() => {
            swipeableRef.current?.close()
            deleteEntry(draft)
          }}
          disabled={isLoading}
          style={{
            backgroundColor: Colors.$backgroundDangerHeavy ?? '#d9534f',
            justifyContent: 'center',
            alignItems: 'center',
            width: 48,
            opacity: isLoading ? 0.4 : 1,
          }}
        >
          <Trash2 size={20} color={'white'} />
        </TouchableOpacity>
        {editable && (
          <TouchableOpacity
            onPress={() => {
              swipeableRef.current?.close()
              onPriceModalOpen?.({
                draft,
                updateDraft,
                onDelete: () => deleteEntry(draft),
                price,
                currentGrade,
                currentGrader,
              })
            }}
            disabled={isLoading}
            style={{
              backgroundColor: Colors.$backgroundNeutralLight,
              justifyContent: 'center',
              alignItems: 'center',
              width: 32,
              opacity: isLoading ? 0.4 : 1,
            }}
          >
            <EllipsisVertical size={20} color={Colors.$iconDefault} />
          </TouchableOpacity>
        )}
      </View>
    ),
    [
      deleteEntry,
      draft,
      isLoading,
      editable,
      onPriceModalOpen,
      updateDraft,
      price,
      currentGrade,
      currentGrader,
    ]
  )

  return !hide ? (
    <Animated.View exiting={FadeOutRight} key={scheme + (!hide ? 'show' : '')}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        enabled={showDelete && !isLoading}
        renderRightActions={showDelete ? renderRightActions : undefined}
        rightThreshold={40}
        overshootRight={false}
        containerStyle={{
          borderBottomColor: Colors.$outlineDefault,
          borderBottomWidth: 1,
        }}
        childrenContainerStyle={{
          zIndex: 1,
          backgroundColor: Colors.$backgroundElevatedLight,
        }}
      >
        <View
          style={{
            position: 'relative',
            width: '100%',
            paddingVertical: 6,
            paddingLeft: 16,
            display: 'flex',
            flexDirection: 'column',
            paddingRight: editable ? 0 : 8,
          }}
        >
          <View
            style={{
              width: '100%',
              alignItems: 'center',
              display: 'flex',
              flexDirection: 'row',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <View style={{ flexShrink: 0, justifyContent: 'flex-end' }}>
              <SkeletonText
                className="text-base uppercase font-spaceMono"
                defaultDimensions={{ height: 12, width: 50 }}
                style={{
                  color: Colors.$textNeutral,
                  fontSize: 12,
                  flexWrap: 'nowrap',
                }}
                numberOfLines={1}
                loading={isLoading ?? false}
              >
                {
                  // @ts-ignore
                  getGradingDisplayString(collectionItem as CollectionItemRow)
                    .slice(0, 2)
                    .join(' ')
                }
              </SkeletonText>
            </View>
            <View
              style={{
                alignItems: 'center',
                display: 'flex',
                flexDirection: 'row',
                flex: 1,
                justifyContent: 'flex-end',
              }}
            >
              <SkeletonText
                className="text-base uppercase font-spaceMono"
                defaultDimensions={{ height: 15, width: 66 }}
                style={
                  price
                    ? null
                    : {
                        color: Colors.$textNeutralLight,
                      }
                }
                loading={isLoading ?? false}
              >
                {price ? formatPrice(price) : '--.--'}
              </SkeletonText>
              <View
                style={{
                  flex: 1,
                  maxWidth: 20,
                  minWidth: 15,
                  alignItems: 'center',
                }}
              >
                <X size={8} color={Colors.$iconDefault} />
              </View>
              <NumberTicker
                disabled={isLoading}
                containerStyle={{ opacity: isLoading ? 0.6 : 1 }}
                stepperProps={{ small: true }}
                min={0}
                max={999}
                initialNumber={isLoading ? undefined : (draft.quantity ?? 0)}
                onChangeNumber={(n) => updateDraft({ quantity: n })}
              />

              {showDelete && (
                <TouchableOpacity
                  onPress={
                    editable
                      ? () =>
                          onPriceModalOpen?.({
                            draft,
                            updateDraft,
                            onDelete: () => deleteEntry(draft),
                            price,
                            currentGrade,
                            currentGrader,
                          })
                      : undefined
                  }
                  disabled={isLoading}
                  style={{ opacity: isLoading ? 0.4 : 1 }}
                >
                  <GripVertical
                    size={16}
                    color={Colors.$iconNeutral ?? Colors.$iconDefault}
                    strokeWidth={1.5}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {collectionItem?.variants?.length ? (
            <View style={{ flexDirection: 'row', paddingTop: 2 }}>
              {collectionItem.variants?.map((v) => (
                <Badge
                  key={v}
                  label={String(v)}
                  size={{ height: 10 }}
                  leftElement={<AccessoryTag size={14} />}
                  labelStyle={{
                    ...Typography.text100,
                    lineHeight: 0,
                    padding: 0,
                  }}
                  containerStyle={{ padding: 3, paddingLeft: 8, paddingRight: 0, borderWidth: 0 }}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ReanimatedSwipeable>
    </Animated.View>
  ) : null
}

export const PriceChangeModal = ({
  cardData: _cardData,
  data,
  onDismiss,
  visible,
}: {
  cardData: TCard
  data: PriceModalPayload | null
  onDismiss: () => void
  visible: boolean
}) => {
  if (!data) return

  const { currentGrader, currentGrade, price, draft, updateDraft, onDelete } = data
  return (
    <Modal visible={visible} onDismiss={onDismiss}>
      <View className="pt-4" style={{ paddingRight: 1, width: '100%', height: '100%' }}>
        <Separator orientation="horizontal" />
        <View className="flex flex-col flex-1 py-4" style={{ width: '100%' }}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              width: '100%',
              gap: 4,
              paddingBottom: 12,
            }}
          >
            <Text variant={'h3'} style={{ fontSize: 24, lineHeight: 26 }}>
              Sell Quantity -{' '}
              <Text
                className="text-base uppercase font-spaceMono"
                style={{
                  color: Colors.$textNeutral,
                  fontSize: 20,
                  lineHeight: 22,
                }}
              >
                {(currentGrader ? `${currentGrader.slug} ` : 'ungraded').toLocaleUpperCase()}
                {currentGrade?.grade_value.toPrecision(2)}
              </Text>
            </Text>
          </View>

          {/* Fields */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            <View
              style={{
                flex: 0.5,
                alignSelf: 'stretch',
                gap: 2,
                paddingBottom: 8,
                paddingTop: 2,
              }}
            >
              <Label style={[styles.floatingPlaceholderTextStyle]}>Quantity</Label>
              <NumberTicker
                min={0}
                max={999}
                initialNumber={draft.quantity ?? 0}
                onChangeNumber={(n) => updateDraft({ quantity: n })}
                containerStyle={{ marginRight: 0, paddingRight: 0 }}
              />
            </View>

            <X size={20} color={Colors.$outlineDefault} style={{ alignSelf: 'center' }} />
            <View style={{ paddingVertical: 8, flex: 1, marginLeft: 8 }}>
              <TextField
                leadingAccessory={<DollarSign color={Colors.$textDefault} />}
                validate={'number'}
                placeholder="Selling Price"
                floatingPlaceholder
                containerStyle={{ flex: 1 }}
                value={price ? formatPrice(price).slice(1) : '0.00'}
              />
            </View>
          </View>

          <Separator orientation="horizontal" style={{ marginVertical: 12 }} />

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => {
                onDelete()
                onDismiss()
              }}
            >
              <Button
                size={'lg'}
                style={{
                  width: '100%',
                  backgroundColor: Colors.$backgroundDangerHeavy ?? '#d9534f',
                }}
              >
                <Trash2 color={'white'} size={16} strokeWidth={2} style={{ marginRight: 4 }} />
                <Text style={{ color: 'white' }}>Delete</Text>
              </Button>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => {
                updateDraft(draft)
                onDismiss()
              }}
            >
              <Button size={'lg'} style={{ width: '100%' }}>
                <Check
                  color={Colors.$iconDefault}
                  size={16}
                  strokeWidth={2}
                  style={{ marginRight: 4 }}
                />
                <Text>Save</Text>
              </Button>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
