import { useCardQuery } from '@/client/card'
import { useGradingConditions } from '@/client/card/grading'
import { suggestedVariantsOptions, Variant } from '@/client/collections/items'

import { useEditCollectionItem } from '@/client/collections/mutate'
import { CollectionLike, EditCollectionArgsItem } from '@/client/collections/types'
import { getDefaultPrice, getGradedPrice } from '@/components/tcg-card/helpers'
import { Badge } from '@/components/ui/badge'
import { useInputColors } from '@/components/ui/input/provider'
import {
  MultiChipInput,
  MultiChipInputProps,
} from '@/components/ui/multi-select-input/multi-select-input'
import { NumberTicker } from '@/components/ui/number-ticker'
import { Text } from '@/components/ui/text'
import { formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { CollectionItemRow } from '@/lib/store/functions/types'
import { useQueryClient } from '@tanstack/react-query'
import { debounce } from 'lodash'
import { Tag, X, XCircle } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import Animated from 'react-native-reanimated'
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

export const CollectionItemEntry = ({
  collection,
  collectionItem,
  onDelete,
  card,
}: {
  collection: CollectionLike
  collectionItem: Partial<CollectionItemRow>
  onDelete?: () => void
  card: TCard
}) => {
  const { data: gradeData, error } = useGradingConditions()

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

  return (
    <View
      style={{
        position: 'relative',
        width: '100%',
        borderBottomColor: Colors.$outlineDefault,
        borderBottomWidth: 1,
        paddingVertical: 6,
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        gap: 12,
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
        {collectionItem.variants?.length && (
          <View style={{ flexDirection: 'row' }}>
            {' '}
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

        <X size={12} />
        <NumberTicker
          min={0}
          max={999}
          initialNumber={draft.quantity ?? 0}
          onChangeNumber={(n) => updateDraft({ quantity: n })}
        />

        {
          <TouchableOpacity
            onPress={() => deleteEntry(draft)}
            // style={[!initialDraft.grade_condition_id ? { opacity: 0, pointerEvents: 'none' } : {}]}
          >
            <XCircle />
          </TouchableOpacity>
        }
      </View>
    </View>
  )
}
