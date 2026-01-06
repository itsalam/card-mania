import { useCardQuery } from '@/client/card'
import { useGradingConditions } from '@/client/card/grading'
import { suggestedVariantsOptions, Variant } from '@/client/collections/items'

import { useEditCollectionItem } from '@/client/collections/mutate'
import { CollectionLike, EditCollectionArgsItem } from '@/client/collections/types'
import { getDefaultPrice, getGradedPrice } from '@/components/tcg-card/helpers'
import { Badge } from '@/components/ui/badge'
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
import { Text } from '@/components/ui/text'
import { formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { CollectionItemRow } from '@/lib/store/functions/types'
import { useQueryClient } from '@tanstack/react-query'
import { debounce } from 'lodash'
import {
  ArrowRight,
  Check,
  DollarSign,
  EllipsisVertical,
  Tag,
  X,
  XCircle,
} from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Button, Colors, TouchableOpacity, Typography } from 'react-native-ui-lib'

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

export const CollectionItemEntry = ({
  collection,
  collectionItem,
  onDelete,
  card,
  editable,
}: {
  collection: CollectionLike
  collectionItem: Partial<CollectionItemRow>
  onDelete?: () => void
  card: TCard
  editable?: boolean
}) => {
  const { data: gradeData, error } = useGradingConditions()
  const [priceModalVisible, setPriceModalVisible] = useState(false)

  const mutate = useEditCollectionItem(
    collectionItem?.collection_id || collection.id!,
    card?.id!,
    collectionItem?.id
  )

  const { data: cardData } = useCardQuery(card.id)

  const initialDraft = useMemo(() => {
    const gradeFormat = gradeData?.find((c) => c.slug === collectionItem.grading_company)
    const grade =
      currentGrade ?? gradeFormat?.grades.find((g) => g.id === collectionItem.grade_condition_id)

    return {
      collection_id: collection.id!,
      ref_id: card?.id!,
      quantity: collectionItem.quantity ?? 0,
      grading_company: gradeFormat?.slug ?? null,
      grade_condition_id: collectionItem.grade_condition?.id ?? grade?.id ?? null,
    }
  }, [collection.id, card?.id, collectionItem, gradeData])

  const [draft, setDraft] = useState<EditCollectionArgsItem>(initialDraft)

  const currentGrader = useMemo(() => {
    if (!gradeData || !collectionItem.grade_condition_id) return undefined
    const gradingCompany = gradeData.find((gd) =>
      gd.grades.some((grade) => grade.id === collectionItem.grade_condition_id)
    )

    return gradingCompany
  }, [gradeData, collectionItem.grade_condition_id])

  const currentGrade = useMemo(() => {
    return currentGrader?.grades.find((grade) => grade.id === collectionItem.grade_condition_id)
  }, [currentGrader])

  useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  const isEqualToInitial = (draft: EditCollectionArgsItem) =>
    draft.quantity === initialDraft.quantity &&
    draft.grading_company === initialDraft.grading_company &&
    draft.grade_condition_id === initialDraft.grade_condition_id

  const mutateEntry = useCallback(
    (draft: EditCollectionArgsItem, patch: Partial<EditCollectionArgsItem>) => {
      if (isEqualToInitial(draft)) return // don’t re-save same data

      mutate.mutate(
        { item: { ...draft, ...patch } },
        {
          onSuccess: (res) => {
            // you can optionally mark clean here; depends on how parent refetches
            setDraft(res)
          },
          onError: (...e) => {
            console.error({ e })
            setDraft(draft)
          },
        }
      )
    },
    [mutate]
  )

  const deleteEntry = useCallback(
    (draft: EditCollectionArgsItem) => {
      mutate.mutate({ item: { ...draft, quantity: 0 } })

      onDelete?.()
    },
    [mutate]
  )

  const mutateDebounce = useCallback(debounce(mutateEntry, 1000), [mutateEntry])

  const updateDraft = (patch: Partial<typeof initialDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    mutateDebounce(draft, patch)
  }

  const price = useMemo(() => {
    if (cardData && gradeData && currentGrade) {
      return getGradedPrice({ card: cardData, graders: gradeData, gradeId: currentGrade.id })
    } else return getDefaultPrice(card)
  }, [collectionItem, gradeData, currentGrade])

  //TODO: Implement modal overriwte/selling options

  return (
    <View
      style={{
        position: 'relative',
        width: '100%',
        borderBottomColor: Colors.$outlineDefault,
        borderBottomWidth: 1,
        paddingVertical: 6,
        display: 'flex',
      }}
    >
      <View
        style={{
          position: 'relative',
          width: '100%',
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'row',
          gap: 8,
        }}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Text
            className="text-base uppercase font-spaceMono"
            style={{
              color: Colors.$textNeutral,
              fontSize: 12,
            }}
          >
            {(currentGrader ? `${currentGrader.slug} ` : 'ungraded').toLocaleUpperCase()}
            {currentGrade?.grade_value.toPrecision(2)}
          </Text>
        </View>
        <View
          style={{
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'row',
            gap: 10,
          }}
        >
          {price?.[1] ? (
            <Text>{formatPrice(price[1])}</Text>
          ) : (
            <Text style={{ color: Colors.$textNeutralLight }}>{'--.--'}</Text>
          )}

          <X size={8} />
          <NumberTicker
            stepperProps={{ small: true }}
            min={0}
            max={999}
            initialNumber={draft.quantity ?? 0}
            onChangeNumber={(n) => updateDraft({ quantity: n })}
          />

          <View
            style={{
              alignItems: 'center',
              display: 'flex',
              flexDirection: 'row',
              gap: 0,
            }}
          >
            <TouchableOpacity onPress={() => deleteEntry(draft)}>
              <XCircle />
            </TouchableOpacity>
            {editable && (
              <TouchableOpacity onPress={() => setPriceModalVisible(true)}>
                <EllipsisVertical />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      {collectionItem.variants?.length && (
        <View style={{ flexDirection: 'row', paddingTop: 2 }}>
          {collectionItem.variants?.map((v) => (
            <Badge
              label={v}
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
      )}
      <Modal visible={priceModalVisible} onDismiss={() => setPriceModalVisible(false)}>
        <View className="pt-4" style={{ paddingRight: 1 }}>
          <Text
            className="text-base uppercase font-spaceMono"
            style={{
              color: Colors.$textNeutral,
              fontSize: 24,
              lineHeight: 26,
            }}
          >
            {(currentGrader ? `${currentGrader.slug} ` : 'ungraded').toLocaleUpperCase()}
            {currentGrade?.grade_value.toPrecision(2)}
          </Text>
          <Separator orientation="horizontal" />
          <View className="flex flex-col flex-1 py-4" style={{ width: '100%' }}>
            <View
              style={{
                alignItems: 'baseline',
                width: '100%',
                gap: 4,
                paddingBottom: 12,
              }}
            >
              <Text variant={'h3'}>Manual Price override -</Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%',
                gap: 4,
              }}
            >
              <View style={{ flex: 0.5, alignSelf: 'stretch', paddingBottom: 14 }}>
                <Label style={[styles.floatingPlaceholderTextStyle, { paddingTop: 2 }]}>
                  Current Price
                </Label>
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {price?.[1] ? (
                    <Text style={{ fontSize: 24 }} variant={'large'}>
                      {formatPrice(price[1])}
                    </Text>
                  ) : (
                    <Text
                      variant={'large'}
                      style={{
                        color: Colors.$textNeutralLight,
                        fontSize: 24,
                      }}
                    >
                      {'--.--'}
                    </Text>
                  )}
                </View>
              </View>

              <ArrowRight size={20} />
              <TextField
                leadingAccessory={<DollarSign />}
                validate={'number'}
                placeholder="New Price"
                floatingPlaceholder
                containerStyle={{ flex: 0.75, margin: 8 }}
              />
            </View>
            <TouchableOpacity style={{ width: '20%', alignSelf: 'flex-end', marginRight: 16 }}>
              <Button
                label="Save"
                iconSource={() => (
                  <Check
                    color={Colors.$iconDefaultLight}
                    size={16}
                    strokeWidth={2}
                    style={{ marginRight: 4 }}
                  />
                )}
              ></Button>
            </TouchableOpacity>
          </View>

          <Separator orientation="horizontal" />
          <View className="flex flex-col flex-1 py-4" style={{ width: '100%' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                width: '100%',
                gap: 4,
                paddingBottom: 12,
              }}
            >
              <Text variant={'h3'}>Sell Quanity</Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%',
                gap: 4,
              }}
            >
              <View
                style={{
                  flex: 0.5,
                  alignSelf: 'stretch',
                  paddingBottom: 14,
                }}
              >
                <Label style={[styles.floatingPlaceholderTextStyle, { paddingTop: 2 }]}>
                  Quanity
                </Label>
                <NumberTicker
                  min={0}
                  max={999}
                  initialNumber={draft.quantity ?? 0}
                  onChangeNumber={(n) => updateDraft({ quantity: n })}
                />
              </View>

              <X size={20} />

              <TextField
                leadingAccessory={<DollarSign />}
                validate={'number'}
                placeholder="Selling Price"
                floatingPlaceholder
                containerStyle={{ flex: 1 }}
                value={price?.[1] ? formatPrice(price?.[1]).slice(1) : '0.00'}
              />
            </View>
            <TouchableOpacity style={{ width: '20%', alignSelf: 'flex-end', marginRight: 16 }}>
              <Button
                label="Save"
                iconSource={() => (
                  <Check
                    color={Colors.$iconDefaultLight}
                    size={16}
                    strokeWidth={2}
                    style={{ marginRight: 4 }}
                  />
                )}
              ></Button>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}
