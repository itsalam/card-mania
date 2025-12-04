import { useGradingConditions } from '@/client/card/grading'
import { suggestedVariantsOptions, Variant } from '@/client/collections/items'

import { useEditCollectionItem } from '@/client/collections/mutate'
import { CollectionLike, EditCollectionArgsItem } from '@/client/collections/types'
import { useInputColors } from '@/components/ui/input/provider'
import { MultiChipInput } from '@/components/ui/multi-select-input/multi-select-input'
import { NumberTicker } from '@/components/ui/number-ticker'
import {
  NativeSelectScrollView,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TCard } from '@/constants/types'
import { CollectionItemRow } from '@/lib/store/functions/types'
import { useQueryClient } from '@tanstack/react-query'
import { debounce } from 'lodash'
import { Tag, XCircle } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, TouchableOpacity } from 'react-native-ui-lib'

const ATag = Animated.createAnimatedComponent(Tag)

const AccessoryTag = () => {
  const { color } = useInputColors()
  //@ts-ignore
  return <ATag size={24} color={color} />
}

export const VariantsSelect = ({ card }: { card: TCard }) => {
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
    <View style={{ flex: 1 }}>
      <MultiChipInput<Partial<Variant> & Pick<Variant, 'id' | 'name'>>
        leadingAccessory={<AccessoryTag />}
        placeholder={'Variants'}
        floatingPlaceholder
        fetchSuggestions={fetchSuggestions}
        extractCat={() => 'general'}
        containerStyle={{ flex: 1 }}
      />
    </View>
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
  const insets = useSafeAreaInsets()
  const contentInsets = {
    top: insets.top,
    bottom: Platform.select({ ios: insets.bottom, android: insets.bottom + 24 }),
    left: 12,
    right: 12,
  }

  const { data: gradeData, error } = useGradingConditions()

  const mutate = useEditCollectionItem(
    collectionItem?.collection_id || collection.id!,
    card?.id!,
    collectionItem?.id
  )

  const initialDraft = useMemo(() => {
    const gradeFormat = gradeData?.find((c) => c.slug === collectionItem.grading_company)
    const grade = gradeFormat?.grades.find((g) => g.id === collectionItem.grade_condition_id)

    return {
      collection_id: collection.id!,
      ref_id: card?.id!,
      quantity: collectionItem.quantity ?? 1,
      grading_company: gradeFormat?.slug ?? null,
      grade_condition_id: collectionItem.grade_condition?.id ?? grade?.id ?? null,
    }
  }, [collection.id, card?.id, collectionItem, gradeData])

  const [draft, setDraft] = useState<EditCollectionArgsItem>(initialDraft)
  const [dirty, setDirty] = useState(false)

  const company = useMemo(
    () => gradeData?.find((c) => c.slug === draft.grading_company),
    [draft, gradeData]
  )
  const gradeIdx = useMemo(
    () => company?.grades.findIndex((g) => g.id === draft.grade_condition_id),
    [company, draft]
  )

  useEffect(() => {
    setDraft(initialDraft)
    setDirty(false)
  }, [initialDraft])

  const isComplete = (draft: EditCollectionArgsItem) =>
    Boolean(draft.grading_company && draft.grade_condition_id && (draft.quantity ?? 0) > 0)

  const isEqualToInitial = (draft: EditCollectionArgsItem) =>
    draft.quantity === initialDraft.quantity &&
    draft.grading_company === initialDraft.grading_company &&
    draft.grade_condition_id === initialDraft.grade_condition_id

  const mutateEntry = useCallback(
    (draft: EditCollectionArgsItem) => {
      if (!isComplete(draft)) return // only when all fields valid
      if (isEqualToInitial(draft)) return // don’t re-save same data

      mutate.mutate(
        { item: draft },
        {
          onSuccess: (res) => {
            // you can optionally mark clean here; depends on how parent refetches
            setDraft(res)
            setDirty(false)
          },
          onError: (...e) => console.log({ e }),
        }
      )
    },
    [mutate]
  )

  const deleteEntry = useCallback(
    (draft: EditCollectionArgsItem) => {
      mutate.mutate({ item: draft, delete: true })
      onDelete?.()
    },
    [mutate]
  )

  const mutateDebounce = useCallback(debounce(mutateEntry, 1000), [mutateEntry])

  const updateDraft = (patch: Partial<typeof initialDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    setDirty(true)
    mutateDebounce({ ...draft, ...patch })
  }

  return (
    <View
      style={{
        position: 'relative',
        width: '100%',
        borderBottomColor: Colors.$outlineDefault,
        borderBottomWidth: 2,
        paddingVertical: 12,
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        gap: 12,
      }}
    >
      <NumberTicker
        min={0}
        max={999}
        initialNumber={draft.quantity ?? 1}
        onChangeNumber={(n) => updateDraft({ quantity: n })}
      />
      <View className="flex flex-col gap-2 flex-1 pb-2">
        <View className="flex flex-row gap-4 w-full">
          <Select
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
            <SelectContent insets={contentInsets}>
              <SelectGroup>
                {gradeData?.map((gradingCompany) => (
                  <SelectItem
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
            style={{
              flex: 1,
            }}
            disabled={!draft.grading_company}
            value={
              gradeIdx !== undefined && gradeIdx >= 0 && company?.grades[gradeIdx]
                ? {
                    value: company?.grades[gradeIdx].id,
                    label: String(company.grades[gradeIdx].grade_value),
                  }
                : undefined
            }
            onValueChange={(option) => {
              updateDraft({ grade_condition_id: option?.value })
            }}
          >
            <SelectTrigger label="Condition" disabled={!draft.grading_company}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent insets={contentInsets}>
              <NativeSelectScrollView>
                <SelectGroup>
                  {company?.grades.map((grade, index) => (
                    <SelectItem
                      key={`${grade.id}-${grade.grade_value}`}
                      label={`${grade.grade_value}`}
                      value={grade.id}
                    >
                      {`${grade.grade_value}`}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </NativeSelectScrollView>
            </SelectContent>
          </Select>
        </View>
        <View className="flex flex-row gap-4">
          <VariantsSelect card={card} />
        </View>
      </View>
      <TouchableOpacity onPress={() => deleteEntry(draft)}>
        <XCircle />
      </TouchableOpacity>
    </View>
  )
}
