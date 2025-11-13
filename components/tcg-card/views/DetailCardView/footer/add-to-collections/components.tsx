import { CompanyWithGrades, useGradingConditions } from '@/client/card/grading'
import { suggestedVariantsOptions, Variant } from '@/client/collections/items'
import { useEditCollecitonItem } from '@/client/collections/mutate'
import { useViewCollectionItemsForCard } from '@/client/collections/query'
import { usePopulateTagCategory } from '@/client/collections/tags'
import { CollectionLike } from '@/client/collections/types'
import { Button } from '@/components/ui/button'
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
import { Text } from '@/components/ui/text'
import { CollectionItemRow } from '@/lib/store/functions/types'
import { Label } from '@rn-primitives/select'
import { useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { FolderHeart, Heart, LucideIcon, Plus, Tag } from 'lucide-react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { Platform, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Colors,
  ExpandableSection,
  RadioButton,
  Timeline,
  TouchableOpacity,
} from 'react-native-ui-lib'
import { useCardDetails } from '../../provider'
// import { Label } from '@react-navigation/elements'

export const VariantsSelect = () => {
  const qc = useQueryClient()
  const { card, setPage, setFooterFullView } = useCardDetails()
  const [query, setQuery] = useState<string>()

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
        leadingAccessory={
          <Tag size={24} color={Colors.$textNeutralLight} style={{ marginTop: 18 }} />
        }
        placeholder={'Variants'}
        floatingPlaceholder
        fetchSuggestions={fetchSuggestions}
        extractCat={() => 'general'}
      />
    </View>
  )
}

export const CollectionCardEntries = ({ collection }: { collection: CollectionLike }) => {
  //TODO: fetch collection entries for this collection and card
  const { card } = useCardDetails()

  // const [entries, setEntries] = useState<Array<Partial<CollectionItemRow>>>([{}])
  const { data: loadedEntries, error } = useViewCollectionItemsForCard(collection.id!, card?.id!)
  const [newEntries, setNewEntries] = useState<Array<Partial<CollectionItemRow>>>([{}])
  return (
    <View style={{ flexDirection: 'column', alignItems: 'center', paddingVertical: 20, gap: 8 }}>
      {(loadedEntries ?? []).map((entry, index, entries) => {
        return (
          <Animated.View style={{ width: '100%' }} key={entry.ref_id}>
            <Timeline
              topLine={{
                state: Timeline.states.NEXT,
                entry: index === 0,
              }}
              point={{
                type: entry.ref_id ? 'bullet' : 'outline',
                state: Timeline.states.NEXT,
              }}
              bottomLine={{
                state: Timeline.states.NEXT,
                type: 'dashed',
                entry: index === (entries?.length ?? 1) - 1,
              }}
            >
              <CollectionEntry
                index={index}
                key={entry.ref_id}
                collectionItem={entry}
                collection={collection}
              />
            </Timeline>
          </Animated.View>
        )
      })}
      {newEntries.map((entry, index, entries) => {
        return (
          <Animated.View style={{ width: '100%' }} key={entry.ref_id}>
            <Timeline
              topLine={{
                state: Timeline.states.NEXT,
                entry: index === 0,
              }}
              point={{
                type: entry.ref_id ? 'bullet' : 'outline',
                state: Timeline.states.NEXT,
              }}
              bottomLine={{
                state: Timeline.states.NEXT,
                type: 'dashed',
                entry: index === (entries?.length ?? 1) - 1,
              }}
            >
              <CollectionEntry
                index={index}
                key={entry.ref_id}
                collectionItem={entry}
                collection={collection}
              />
            </Timeline>
          </Animated.View>
        )
      })}
      <Animated.View style={{ width: '100%' }}>
        <Timeline
          topLine={{
            state: Timeline.states.NEXT,
            // entry: index === 0,
          }}
          point={{
            // type: entry.ref_id ? 'bullet' : 'outline',
            state: Timeline.states.NEXT,
          }}
          bottomLine={{
            state: Timeline.states.NEXT,
            type: 'dashed',
            // entry: index === (entries?.length ?? 1) - 1,
          }}
        >
          <View
            style={{
              paddingVertical: 4,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 28,
            }}
          >
            <TouchableOpacity
              style={{
                width: '100%',
              }}
              onPress={() => {
                setNewEntries((prev) => [...prev, {}])
              }}
            >
              <Button
                style={{
                  width: '100%',
                  backgroundColor: Colors.$backgroundPrimaryHeavy,
                }}
              >
                <Text style={{ color: Colors.$textDefaultLight }}>Add Variants</Text>
                <Plus color={Colors.$textDefaultLight} />
              </Button>
            </TouchableOpacity>
          </View>
        </Timeline>
      </Animated.View>
    </View>
  )
}

export const CollectionEntry = ({
  collection,
  collectionItem,
  onUpdate,
  index,
}: {
  collection: CollectionLike
  collectionItem: Partial<CollectionItemRow>
  onUpdate?: (c: Partial<CollectionItemRow>) => void
  index?: number
}) => {
  const { card } = useCardDetails()
  const insets = useSafeAreaInsets()
  const contentInsets = {
    top: insets.top,
    bottom: Platform.select({ ios: insets.bottom, android: insets.bottom + 24 }),
    left: 12,
    right: 12,
  }

  const { data: gradeData, error } = useGradingConditions()
  const [selectedQuantity, setSelectedQuantity] = useState<number>(collectionItem?.quantity || 1)
  const [selectedGrade, setSelectedGrade] = useState<
    CompanyWithGrades['grades'][number] | undefined
  >(undefined)
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null)
  const [selectedGradeCompany, setSelectedGradeCompany] = useState<CompanyWithGrades | undefined>(
    gradeData?.[0]
  )
  const [enabledEntry, setEnabledEntry] = useState<boolean>(!!collectionItem?.ref_id)
  const mutate = useEditCollecitonItem(
    collectionItem?.collection_id || collection.id!,
    card?.id!,
    collectionItem?.id
  )

  useEffect(() => {
    if (index === 0) {
      onUpdate?.({
        ref_id: card?.id,
        collection_id: collection.id,
      })
      return
    }
    if (!enabledEntry) {
      setSelectedGrade(undefined)
      setSelectedCondition(null)
      setSelectedGradeCompany(undefined)
    } else {
      if (!collectionItem?.ref_id) {
        onUpdate?.({
          ref_id: card?.id,
          collection_id: collection.id,
        })
      }
    }
  }, [enabledEntry, index])

  useEffect(() => {
    if (selectedGradeCompany && selectedGrade) {
      onUpdate?.({
        collection_id: collection.id,
        grade_condition_id: selectedGradeCompany?.slug || null,
        grading_company: selectedGrade?.id || null,
        condition: selectedCondition,
        quantity: selectedQuantity,
      })
      mutate.mutate({
        collection_id: collection.id!,
        grade_condition_id: selectedGradeCompany?.slug || null,
        grading_company: selectedGrade?.id || null,
        ref_id: card?.id!,
        condition: selectedCondition,
        quantity: selectedQuantity,
      })
    }
  }, [selectedGradeCompany, selectedGrade, selectedCondition, selectedQuantity])

  return (
    <View className="flex flex-row w-full">
      <View className="flex flex-col gap-1 flex-1">
        <View className="flex flex-row gap-4 w-full">
          <Select
            onValueChange={(option) => {
              setSelectedGradeCompany(gradeData?.find((company) => company.id === option?.value))
              setSelectedGrade(undefined)
            }}
            style={{
              flex: 0.3,
            }}
          >
            <Label>Format</Label>
            <SelectTrigger>
              <SelectValue placeholder="Grading Type" />
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
              flex: 0.6,
            }}
            disabled={!selectedGradeCompany}
            onValueChange={(option) =>
              setSelectedGrade(selectedGradeCompany?.grades[Number(option?.value as string)])
            }
          >
            <Label>Grade</Label>
            <SelectTrigger>
              <SelectValue placeholder="Grade Condition" />
            </SelectTrigger>
            <SelectContent insets={contentInsets}>
              <NativeSelectScrollView>
                <SelectGroup>
                  {selectedGradeCompany?.grades.map((grade, index) => (
                    <SelectItem
                      key={grade.grade_value}
                      label={`${grade.grade_value} ${grade.label}`}
                      value={String(index)}
                    >
                      {`${grade.grade_value} ${grade.label}`}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </NativeSelectScrollView>
            </SelectContent>
          </Select>
        </View>
        <View className="flex flex-row gap-4">
          <VariantsSelect />
        </View>
      </View>
      <NumberTicker
        min={0}
        max={999}
        initialNumber={selectedQuantity}
        onChangeNumber={(inputData) => setSelectedQuantity(inputData)}
      />
    </View>
  )
}

const CollectionsAvatar = ({
  icon: Icon,
  iconImageSrc,
}: {
  icon?: LucideIcon
  iconImageSrc?: string
}) => {
  return (
    <View className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
      {Icon ? (
        <Icon height={24} width={24} strokeWidth={2} stroke={Colors.$textPrimary} />
      ) : iconImageSrc ? (
        <Image source={{ uri: iconImageSrc }} style={{ height: 32, width: 32 }} />
      ) : (
        <FolderHeart height={20} width={20} strokeWidth={1.5} stroke={Colors.$textPrimary} />
      )}
    </View>
  )
}

export const CollectionListItem = ({ collection }: { collection: CollectionLike }) => {
  const { get: getTagCategory } = usePopulateTagCategory(collection.tags_cache)
  const { card } = useCardDetails()
  const [expanded, setExpanded] = useState(false)

  return (
    <ExpandableSection
      expanded={expanded}
      sectionHeader={
        <View className="flex flex-row items-center gap-4 px-4" key={collection.id}>
          <CollectionsAvatar icon={Heart} iconImageSrc={collection.cover_image_url} />
          <View key={collection.id} className="shrink-0 grow">
            <Text className="text-lg font-medium">{collection.name}</Text>
            <Text
              className="text-sm"
              style={{
                color: Colors.$textSecondary,
              }}
            >
              {collection.description}
            </Text>
          </View>
          <RadioButton selected={collection.has_item} />
        </View>
      }
      onPress={() => setExpanded(!expanded)}
    >
      <CollectionCardEntries collection={collection} />
    </ExpandableSection>
  )
}
