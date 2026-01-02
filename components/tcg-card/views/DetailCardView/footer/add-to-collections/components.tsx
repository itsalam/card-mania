import { useViewCollectionItemsForCard } from '@/client/collections/query'
import { CollectionItem, CollectionLike, EditCollectionArgsItem } from '@/client/collections/types'
import {
  CollectionItemEntry,
  VariantsSelect,
} from '@/components/collections/items/editable-entry-item'
import { Spinner } from '@/components/ui/spinner'
import { TCard } from '@/constants/types'
import { CollectionItemRow } from '@/lib/store/functions/types'
import { Plus, TriangleAlert } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleProp,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Button, Colors } from 'react-native-ui-lib'

import { useGradingConditions } from '@/client/card/grading'
import {
  NativeSelectScrollView,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { qk } from '@/lib/store/functions/helpers'
import { useQueryClient } from '@tanstack/react-query'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'
import { thumbStyles } from '../../ui'
// import { Label } from '@react-navigation/elements'

export const CollectionCardEntries = ({
  collection,
  isShown,
  card,
  style,
}: {
  collection: CollectionLike
  isShown: boolean
  card: TCard
  style?: StyleProp<ViewStyle>
}) => {
  const {
    data: loadedEntries,
    isLoading,
    refetch,
  } = useViewCollectionItemsForCard(collection.id!, card?.id!, isShown)

  const [newEntries, setNewEntries] = useState<Array<Partial<CollectionItemRow>>>(
    loadedEntries.length ? loadedEntries : [{}]
  )

  const [showModal, setShowModal] = useState(false)
  const handleDismiss = useCallback(() => {
    setShowModal(false)
  }, [refetch])

  useEffect(() => {
    const hasUngradedItems = loadedEntries.some(
      (e) => e.grading_company === null && e.quantity >= 1
    )
    const baseEntries = hasUngradedItems
      ? loadedEntries
      : [{ grading_company: null, quantity: 0, grade_condition_id: null }, ...loadedEntries]

    const sortedEntries = [...baseEntries].sort((a, b) => {
      const aHasCompany = Boolean(a.grading_company_id || a.grading_company)
      const bHasCompany = Boolean(b.grading_company_id || b.grading_company)
      if (aHasCompany !== bHasCompany) return aHasCompany ? 1 : -1

      const aCompany = (a.grading_company ?? '').toLowerCase()
      const bCompany = (b.grading_company ?? '').toLowerCase()
      if (aCompany !== bCompany) return aCompany.localeCompare(bCompany)

      const aGradeValue = a.grade_condition?.grade_value ?? Number.NEGATIVE_INFINITY
      const bGradeValue = b.grade_condition?.grade_value ?? Number.NEGATIVE_INFINITY
      if (aGradeValue !== bGradeValue) return aGradeValue - bGradeValue

      const aVariants = a.variants ?? []
      const bVariants = b.variants ?? []
      const aVariantsEmpty = aVariants.length === 0
      const bVariantsEmpty = bVariants.length === 0
      if (aVariantsEmpty !== bVariantsEmpty) return aVariantsEmpty ? -1 : 1
      const aVariantsKey = aVariants.join(',').toLowerCase()
      const bVariantsKey = bVariants.join(',').toLowerCase()
      if (aVariantsKey !== bVariantsKey) return aVariantsKey.localeCompare(bVariantsKey)

      const aCreatedBy = a.updated_at ?? ''
      const bCreatedBy = b.updated_at ?? ''
      return aCreatedBy.localeCompare(bCreatedBy)
    })
    setNewEntries(sortedEntries)
  }, [loadedEntries])

  return (
    <View style={[style]}>
      {isLoading || card === null ? (
        <Spinner />
      ) : (
        newEntries.map((entry, index) => {
          return (
            <CollectionItemEntry
              card={card}
              key={`${index}-new`}
              collectionItem={entry}
              collection={collection}
            />
          )
        })
      )}

      <Button
        highLighted
        size="xSmall"
        style={{
          flexGrow: 0,
          alignSelf: 'flex-end',
          marginTop: 8,
          paddingHorizontal: 20,
          paddingVertical: 4,
          marginRight: 34,
        }}
        onPress={() => {
          setShowModal(true)
          // setNewEntries((prev) => [...prev, {}])
        }}
        color={Colors.$iconDefault}
        label="Add"
        iconSource={(style) => <Plus style={style} color={Colors.$iconDefault} />}
      />
      <AddVariantModal
        entries={newEntries}
        collection={collection}
        item={card}
        visible={showModal}
        onDismiss={handleDismiss}
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
  entries: Array<Partial<CollectionItemRow>>
  collection: CollectionLike
  item: TCard
  visible: boolean
  onDismiss: () => void
}) => {
  const qc = useQueryClient()
  const { data: gradeData, error } = useGradingConditions()
  const { height: screenHeight } = useWindowDimensions()
  const translateY = useSharedValue(screenHeight)
  const [saving, setSaving] = useState(false)

  const initialDraft = useMemo<EditCollectionArgsItem>(() => {
    return {
      ref_id: item?.id!,
      quantity: 0,
      grading_company: null,
      grade_condition_id: null,
      collection_id: collection.id!,
      item_kind: 'card',
    }
  }, [item?.id, gradeData])

  const [draft, setDraft] = useState<EditCollectionArgsItem>(initialDraft)

  useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  const collectionItemsKey = useMemo(
    () => [...qk.collectionItems(collection.id!), 'cardId', item.id],
    [collection.id, item.id]
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

  const insets = useSafeAreaInsets()
  const contentInsets = {
    top: insets.top,
    bottom: Platform.select({ ios: insets.bottom, android: insets.bottom + 24 }),
    left: 12,
    right: 12,
  }

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

  useEffect(() => {
    if (!visible) return
    translateY.value = screenHeight
    translateY.value = withTiming(0, {
      duration: 240,
      easing: Easing.out(Easing.ease),
    })
  }, [screenHeight, translateY, visible])

  const dismiss = useCallback(() => {
    translateY.value = withTiming(
      screenHeight,
      { duration: 200, easing: Easing.in(Easing.ease) },
      (finished) => {
        if (finished) scheduleOnRN(onDismiss)
      }
    )
  }, [onDismiss, screenHeight, translateY])

  const panGesture = Gesture.Pan()
    .onChange((e) => {
      if (e.translationY > 0) translateY.value = e.translationY
    })
    .onEnd((e) => {
      const shouldDismiss = e.translationY > screenHeight * 0.2 || e.velocityY > 900
      if (shouldDismiss) {
        scheduleOnRN(dismiss)
      } else {
        translateY.value = withTiming(0, {
          duration: 200,
          easing: Easing.out(Easing.ease),
        })
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={dismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.5) }}
        behavior={'translate-with-padding'}
      >
        <Pressable style={{ flex: 1 }} onPress={dismiss} />
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              thumbStyles.thumbContainer,
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: 16,
                paddingBottom: contentInsets.bottom,
                backgroundColor: Colors.$backgroundDefault,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                justifyContent: 'center',
                width: '100%',
                alignItems: 'stretch',
              },
              sheetStyle,
            ]}
          >
            <View style={[thumbStyles.thumb, { marginHorizontal: 'auto' }]} />
            <View className="flex flex-col gap-4 flex-1 pt-4">
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
                    <SelectValue />
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
                            {`${grade.grade_value}`}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </NativeSelectScrollView>
                  </SelectContent>
                </Select>
              </View>

              <View className="flex flex-col">
                {/* {alreadyExists && <Text></Text>} */}
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
              {alreadyExists(draft) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <TriangleAlert size={20} color={Colors.$textDanger} />
                  <Text style={{ color: Colors.$textDanger }}>
                    {'Collection type already exists.'}
                  </Text>
                </View>
              )}

              <Button
                label="Add"
                disabled={!enableSave}
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
                      return [...current, draft]
                    })
                  }
                  setSaving(false)
                  dismiss()
                }}
                iconSource={() => (saving ? <Spinner color={Colors.$textDefaultLight} /> : null)}
              ></Button>
            </View>
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </Modal>
  )
}
