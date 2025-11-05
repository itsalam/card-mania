import { Text } from '@/components/ui/text'

import { TagCategoryToIcon } from '@/components/icons'
import { BADGE_HEIGHT, BadgeInput, ToggleBadge } from '@/components/ui/badge'
import { splitToNChunks } from '@/components/utils'
import { TriggerRef } from '@rn-primitives/popover'
import {
  forwardRef,
  PropsWithoutRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, {
  FadeOut,
  SequencedTransition,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { ChipsInputProps, Colors } from 'react-native-ui-lib'
import { ChipsInputChipProps } from 'react-native-ui-lib/src/components/chipsInput'

type MultiChipInputProps<T, S> = ChipsInputProps & {
  fetchSuggestions?: (query?: string) => Promise<S[]>
  compare: (i1: S | T, i2: S | T) => boolean
  renderIcon?: (item?: Partial<T | S>) => React.ReactElement
  extractCat?: (item: Partial<T | S>) => string
}

type BaseTagObject = {
  id?: string
  name?: string
  category?: string
}

const defaultIconRender =
  <T,>(extractCat: (item: T) => string) =>
  (reqTag?: T) => {
    const IconComp =
      TagCategoryToIcon[
        (reqTag ? extractCat(reqTag) : 'general') as keyof typeof TagCategoryToIcon
      ] ?? TagCategoryToIcon.general
    return (
      <IconComp
        height={24}
        width={24}
        style={{ marginLeft: 10 }}
        stroke={Colors.$textDefaultLight}
      />
    )
  }

export const MultiChipInputBase = <T extends BaseTagObject, S extends BaseTagObject>(
  {
    floatingPlaceholderStyle,
    placeholder,
    onChangeText,
    fetchSuggestions,
    compare,
    renderIcon,
    extractCat = (item) => item.category ?? '',
    ...props
  }: MultiChipInputProps<T, S>,
  ref: React.ForwardedRef<typeof BadgeInput>
) => {
  const NUM_PRICE_ROWS = 2

  const viewRef = useRef<TriggerRef>(null)

  const [items, setItems] = useState<T[]>([])
  const [isFocused, setIsFocused] = useState(false)
  const [hasInput, setHasInput] = useState(false)
  const [query, setQuery] = useState<string>()
  const [suggestions, setSuggestions] = useState<S[]>([])

  useEffect(() => {
    if (fetchSuggestions) {
      fetchSuggestions(query).then(setSuggestions)
    }
  }, [query, fetchSuggestions])

  const [chipProps, setChipProps] = useState<ChipsInputChipProps[]>([])

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
        suggestions?.filter((s) => !items.find((t) => compare(t, s))) ?? [],
        NUM_PRICE_ROWS,
        3
      ).filter((r) => r.length > 0) as T[][],
    [suggestions, items]
  )

  const tagSearchResultsStyle = useAnimatedStyle(() => {
    return {
      height: withTiming(
        isFocused ? BADGE_HEIGHT * NUM_PRICE_ROWS + (NUM_PRICE_ROWS - 1) * 4 + 60 : 0
      ),
      borderColor: withTiming(isFocused ? borderColors[0] : borderColors[1]),
    }
  }, [isFocused])

  const renderIconElement = useCallback(renderIcon ?? defaultIconRender<T>(extractCat), [
    renderIcon,
    extractCat,
  ])

  useEffect(() => {
    setChipProps(
      items.map((t) => {
        return {
          label: t.name as string,
          id: t.id,
          leftElement: renderIconElement(t),
        }
      })
    )
  }, [items, renderIconElement])

  return (
    <View ref={viewRef}>
      <BadgeInput
        label="Tags"
        labelStyle={{
          ...(hasInput || items.length ? { opacity: 1 } : { opacity: 0.0 }),

          color: Colors.$textNeutralLight,
        }}
        ref={ref}
        placeholder={hasInput || items.length ? '' : 'Tags'}
        chips={chipProps}
        value={query}
        onFocus={() => {
          setIsFocused(true)
        }}
        onBlur={() => {
          setQuery('')
          setIsFocused(false)
        }}
        onChangeText={(text) => {
          setHasInput(text.length > 0)
          if (onChangeText) onChangeText?.(text)

          const cleaned = text.replace(/\s+/g, ' ').trim()
          const tokens = cleaned
            .split('  ')
            .filter(Boolean)
            .map((t) => t.trim())

          if (tokens.length > 1) {
            setQuery('')
          } else {
            setQuery(text)
          }
        }}
        //@ts-ignore
        inputStyle={[styles.input]}
        fieldStyle={[{ rowGap: 0 }]}
        style={[{ flexGrow: 0 }]}
        defaultChipProps={{
          leftElement: renderIconElement(),
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
                          setItems([...items, item])
                        }}
                        key={item.id}
                        checked
                        leftElement={renderIconElement(item)}
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
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                height: BADGE_HEIGHT,
              }}
            >
              {/* <Text>No Results</Text> */}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  )
}

function fixedForwardRef<T, P = {}>(
  render: (props: PropsWithoutRef<P>, ref: React.Ref<T>) => React.ReactNode
): (props: PropsWithoutRef<P> & React.RefAttributes<T>) => React.ReactNode {
  return forwardRef(render) as any
}

export const MultiChipInput = fixedForwardRef(MultiChipInputBase)

export const FooterStyles = StyleSheet.create({
  titleFloatingPlaceholderStyle: { fontSize: 28, lineHeight: 48 },
  formContainer: {
    backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
    borderColor: Colors.rgba(Colors.$backgroundNeutralHeavy, 0.1),
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderRadius: 12,
  },
  titleInputBody: {
    fontWeight: '500',
    fontSize: 32,
    lineHeight: 40,
  },
  attributeInputContainer: {
    backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
    borderColor: Colors.rgba(Colors.$backgroundNeutralMedium, 1.0),
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  attributeInputBody: {
    fontWeight: '500',
    fontSize: 20,
    lineHeight: 22,
  },
  tagsInputBody: {
    padding: 0,
    margin: 0,
  },

  attributeFloatingPlaceholderStyle: { fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
    borderColor: Colors.rgba(Colors.$backgroundNeutralMedium, 1.0),
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 12,
    height: 80,
  },
  footerButton: {},
})
