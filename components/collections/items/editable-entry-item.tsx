import { useCardQuery } from '@/client/card'
import { Graders, useGradingConditions } from '@/client/card/grading'
import { suggestedVariantsOptions, Variant } from '@/client/collections/items'

import { useEditCollectionItem } from '@/client/collections/mutate'
import { CollectionLike, EditCollectionArgsItem } from '@/client/collections/types'
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
import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { CollectionItemRow } from '@/lib/store/functions/types'
import { useQueryClient } from '@tanstack/react-query'
import { debounce } from 'lodash'
import { Check, DollarSign, EllipsisVertical, Tag, X, XCircle } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import Animated, { FadeOutRight } from 'react-native-reanimated'
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
}: {
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

  const mutate = useEditCollectionItem(
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
            setHide(false)
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

      setHide(true)
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
    if (cardData && gradeData) {
      return getGradedPrice({ card: cardData, graders: gradeData, gradeId: currentGrade?.id })
    } else return null
  }, [collectionItem, gradeData, currentGrade])
  const scheme = useEffectiveColorScheme() // 'light' | 'dark' | null
  //TODO: Implement modal overriwte/selling options

  return !hide ? (
    <Animated.View
      exiting={FadeOutRight}
      key={scheme + (!hide ? 'show' : '')}
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
          <SkeletonText
            className="text-base uppercase font-spaceMono"
            defaultDimensions={{ height: 12, width: 50 }}
            style={{
              color: Colors.$textNeutral,
              fontSize: 12,
            }}
            loading={isLoading}
          >
            {`${(currentGrader ? `${currentGrader.slug} ` : 'ungraded').toLocaleUpperCase()}${
              currentGrade?.grade_value.toPrecision(2) ?? ''
            }`}
          </SkeletonText>
        </View>
        <View
          style={{
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'row',
            gap: 10,
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
            loading={isLoading}
          >
            {price ? formatPrice(price) : '--.--'}
          </SkeletonText>

          <X size={8} color={Colors.$iconDefault} />
          <NumberTicker
            disabled={isLoading}
            containerStyle={{ opacity: isLoading ? 0.6 : 1 }}
            stepperProps={{ small: true }}
            min={0}
            max={999}
            initialNumber={isLoading ? undefined : (draft.quantity ?? 0)}
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
            <TouchableOpacity
              onPress={() => deleteEntry(draft)}
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.4 : 1 }}
            >
              <XCircle color={Colors.$iconDefault} />
            </TouchableOpacity>
            {editable && (
              <TouchableOpacity
                onPress={() =>
                  onPriceModalOpen?.({ draft, updateDraft, price, currentGrade, currentGrader })
                }
                disabled={isLoading}
                style={{ opacity: isLoading ? 0.4 : 1 }}
              >
                <EllipsisVertical color={Colors.$iconDefault} />
              </TouchableOpacity>
            )}
          </View>
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
    </Animated.View>
  ) : null
}

export const PriceChangeModal = ({
  data,
  onDismiss,
  visible,
}: {
  data: PriceModalPayload | null
  onDismiss: () => void
  visible: boolean
}) => {
  if (!data) return

  const { currentGrader, currentGrade, price, draft, updateDraft } = data
  return (
    <Modal visible={visible} onDismiss={onDismiss}>
      <View className="pt-4" style={{ paddingRight: 1, width: '100%', height: '100%' }}>
        <Separator orientation="horizontal" />

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
            <Text variant={'h3'} style={{ fontSize: 24, lineHeight: 26 }}>
              Sell Quanity -{' '}
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
              <Label style={[styles.floatingPlaceholderTextStyle]}>Quanity</Label>
              <NumberTicker
                min={0}
                max={999}
                initialNumber={draft.quantity ?? 0}
                onChangeNumber={(n) => updateDraft({ quantity: n })}
                containerStyle={{ marginRight: 0, paddingRight: 0 }}
              />
            </View>

            <X size={20} color={Colors.$outlineDefault} style={{ alignSelf: 'center' }} />
            <View
              style={{
                paddingVertical: 8,
                flex: 1,
                marginLeft: 8,
              }}
            >
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
          <TouchableOpacity
            style={{ width: '30%', alignSelf: 'flex-end', margin: 4 }}
            onPress={() => updateDraft(draft)}
          >
            <Button size={'lg'} style={{ width: '100%', marginRight: 4 }}>
              <Text>Save</Text>
              <Check
                color={Colors.$iconDefault}
                size={16}
                strokeWidth={2}
                style={{ marginRight: 4 }}
              />
            </Button>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
