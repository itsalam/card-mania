import { Text } from '@/components/ui/text'

import { SuggestedTag, useSuggestedTags } from '@/client/collections/tags'
import { TagCategoryToIcon } from '@/components/icons'
import { BADGE_HEIGHT, BadgeInput, ToggleBadge } from '@/components/ui/badge'
import { splitToNChunks } from '@/components/utils'
import { TTag } from '@/constants/types'
import { TriggerRef } from '@rn-primitives/popover'
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import Animated, {
  FadeOut,
  SequencedTransition,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { ChipsInputProps, Colors } from 'react-native-ui-lib'
import {
  ChipsInputChangeReason,
  ChipsInputChipProps,
} from 'react-native-ui-lib/src/components/chipsInput'
import { useCreateNewCollections } from '../../provider'
import { CreateCollectionInputProps } from './input'
import { FooterStyles as styles } from './styles'

export const CreateCollectionChipInput = forwardRef<
  typeof BadgeInput,
  CreateCollectionInputProps<ChipsInputProps>
>(({ floatingPlaceholderStyle, placeholder, onChangeText, ...props }, ref) => {
  const NUM_PRICE_ROWS = 2

  const tags = useCreateNewCollections((s) => s.tags)
  const requestedTags = useCreateNewCollections((s) => s.requestedTags)
  const setTags = useCreateNewCollections((s) => s.setTags)
  const setRequestedTags = useCreateNewCollections((s) => s.setRequestedTags)

  const viewRef = useRef<TriggerRef>(null)

  const [isFocused, setIsFocused] = useState(false)
  const [hasInput, setHasInput] = useState(false)
  const [currTagQuery, setCurrTagQuery] = useState<string>()
  const { data: suggestions } = useSuggestedTags({ search: currTagQuery })

  const [chipProps, setChipProps] = useState<ChipsInputChipProps[]>([])

  const visibleTags = useMemo(() => {
    return tags.concat(requestedTags.filter((rt) => !tags.find((t) => t.id === rt.id)))
  }, [tags, requestedTags])

  const borderColors = useMemo(
    () => [
      Colors.rgba(Colors.$backgroundNeutralMedium, 1.0) as string,
      Colors.rgba(Colors.$backgroundNeutralMedium, 0.0) as string,
    ],
    []
  )
  const rows = useMemo(
    () =>
      splitToNChunks(
        suggestions?.filter((s) => !visibleTags.find((t) => t.name === s.name)) ?? [],
        NUM_PRICE_ROWS,
        3
      ).filter((r) => r.length > 0) as SuggestedTag[][],
    [suggestions, visibleTags]
  )

  const tagSearchResultsStyle = useAnimatedStyle(() => {
    return {
      height: withTiming(
        isFocused ? BADGE_HEIGHT * NUM_PRICE_ROWS + (NUM_PRICE_ROWS - 1) * 4 + 60 : 0
      ),
      borderColor: withTiming(isFocused ? borderColors[0] : borderColors[1]),
    }
  }, [isFocused])

  const renderIconElement = useCallback((reqTag: Partial<TTag & { category: string }>) => {
    const IconComp =
      TagCategoryToIcon[reqTag?.category as keyof typeof TagCategoryToIcon] ??
      TagCategoryToIcon.general
    return (
      <IconComp
        height={24}
        width={24}
        style={{ marginLeft: 10 }}
        stroke={Colors.$textDefaultLight}
      />
    )
  }, [])

  useEffect(() => {
    setChipProps(
      visibleTags.map((t) => {
        return {
          label: t.name as string,
          id: t.id,
          leftElement: renderIconElement(t),

        }
      })
    )
  }, [visibleTags, renderIconElement])

  return (
    <View ref={viewRef}>
      <BadgeInput
        label="Tags"
        labelStyle={{
          ...(hasInput || visibleTags.length
            ? { opacity: 1 }
            : { opacity: 0.0 }),

          color: Colors.$textNeutralLight,
        }}
        ref={ref}
        placeholder={hasInput || visibleTags.length ? "" : 'Tags'}
        chips={chipProps}
        value={currTagQuery}
        onFocus={() => {
          setIsFocused(true)
        }}
        onBlur={() => {
          setCurrTagQuery('')
          setIsFocused(false)
        }}
        onChangeText={(text) => {
          setHasInput(text.length > 0)
          onChangeText?.(text)
          const cleaned = text.replace(/\s+/g, ' ').trim()
          const tokens = cleaned
            .split('  ')
            .filter(Boolean)
            .map((t) => t.trim())

          if (tokens.length > 1) {
            setRequestedTags([...requestedTags, { name: tokens[0] }])
            setCurrTagQuery('')
          } else {
            setCurrTagQuery(text)
          }
        }}
        //@ts-ignore
        onChange={(newChips: ChipsInputChipProps[], changeReason: ChipsInputChangeReason) => {
          if (changeReason === 'added') {
            const addUnique = (tags: Partial<TTag>[]) =>
              newChips
                .filter((nc) => !tags.find((t) => t.name === nc.label || t.id === nc.id))
                .map((nc) => ({ name: nc.label, id: nc.id }))
            setRequestedTags([...requestedTags, ...addUnique(requestedTags)])
          } else if (changeReason === 'removed') {
            const filterTag = (tags: Partial<TTag>[]) =>
              tags.filter((t) => newChips.find((nc) => nc.label === t.name || nc.id === t.id))
            if (newChips.length === 0) {
              setTags([])
              setRequestedTags([])
            } else {
              setRequestedTags(filterTag(requestedTags))
              setTags(filterTag(tags))
            }
          }
        }}
        inputStyle={[styles.input]}
        fieldStyle={[styles.tagsInputBody, { rowGap: 0} ]}
        style={[styles.attributeInputBody, { flexGrow: 0 }]}
        defaultChipProps={{
          leftElement: renderIconElement({}),
        }}
        {...props}
      />
      <Animated.View
        style={[
          tagSearchResultsStyle,
          {
            overflow: 'hidden',
            paddingVertical: 8,
          },
        ]}
      >
        <Text
          style={{
            color: Colors.$textNeutralLight,
          }}
        >
          {'Suggested'}
        </Text>
        <ScrollView
          horizontal
          contentContainerStyle={[
            {
              display: 'flex',
              flexDirection: 'column',
              paddingVertical: 4,
            },
          ]}
        >
          {rows.length ? (
            rows.map((row, index) => (
              <View
                key={`row-${index}`}
                style={[
                  {
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'nowrap',
                    rowGap: 6,
                    columnGap: 8,
                    paddingVertical: 4,
                    paddingHorizontal: 4,
                  },
                ]}
              >
                {row.map((item) => {
                  return (
                    <Animated.View
                      key={`tag-${item.id}`}
                      // sharedTransitionTag={`tag-${item.id}`}
                      layout={SequencedTransition.reverse()}
                      // entering={FadeIn.duration(75)}
                      exiting={FadeOut.duration(75)}
                    >
                      <ToggleBadge
                        onPress={() => {
                          setTags([...tags, { ...item, category: item.category_slugs?.[0] }])
                        }}
                        key={item.id}
                        checked
                        leftElement={renderIconElement({
                          ...item,
                          category: item.category_slugs?.[0],
                        })}
                        label={item.name}
                      >
                        {item.name}
                      </ToggleBadge>
                    </Animated.View>
                  )
                })}
              </View>
            ))
          ) : (
            <View style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              height: BADGE_HEIGHT,
              
            }}>
              {/* <Text>No Results</Text> */}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  )
})

CreateCollectionChipInput.displayName = 'CreateCollectionChipInput'
