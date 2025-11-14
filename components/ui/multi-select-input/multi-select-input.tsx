import { Text } from '@/components/ui/text'

import { TagCategoryToIcon } from '@/components/icons'
import { BADGE_HEIGHT, ToggleBadge } from '@/components/ui/badge'
import { splitToNChunks } from '@/components/utils'
import { once } from 'lodash'
import {
  createContext,
  forwardRef,
  Ref,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { ScrollView, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  SequencedTransition,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { BadgeInputInner, ChipsInputProps } from '../input/badge-input'
import { TextField, TextFieldHandle } from '../input/base-input'
import { FieldContext } from '../input/provider'
import { InputProps } from '../input/types'

export type ChipsContextValue<T extends BaseTagObject> = {
  items: T[]
  setItems: (items: T[]) => void
  suggestions: T[]
  setSuggestions: (suggestions: T[]) => void
  hasResults: SharedValue<boolean>
  renderIconElement: (reqTag?: T | undefined) => React.JSX.Element
}

type MultiChipInputProps<T> = Omit<ChipsInputProps, 'children'> & {
  fetchSuggestions: (query?: string) => Promise<T[]>
  compare?: (i1: T, i2: T) => boolean
  renderIcon?: (item?: Partial<T> & BaseTagObject) => React.ReactElement
  extractCat?: (item: T) => string
  fetchItems?: (ids: BaseTagObject[]) => Promise<T[]>
  onItemsChange?: (items: T[]) => void
  children?:
    | React.JSX.Element
    | ((props: MultiChipInputProps<T>, ref: Ref<TextFieldHandle>) => React.JSX.Element)
}

type BaseTagObject = {
  id: string
  name: string
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

export const createChipsContext = once(<T extends BaseTagObject>() =>
  createContext<ChipsContextValue<T> | null>(null)
)
export const useChipContext = <T extends BaseTagObject>() => {
  const context = useContext(createChipsContext<T>())
  if (!context) {
    throw new Error('MultiChipInput must be used within a ChipsContext.Provider')
  }
  return context
}

export const MultiChipInput = <T extends BaseTagObject>(props: MultiChipInputProps<T>) => {
  const {
    fetchSuggestions,
    compare = (a: BaseTagObject, b: BaseTagObject) => a.id === b.id,
    renderIcon,
    extractCat = (item: BaseTagObject) => item.category ?? 'general',
    onItemsChange,
    ...badgeProps
  } = props

  return <TextField {...badgeProps}>{MultiChipInput.Provider<T>(props)}</TextField>
}

MultiChipInput.Provider = <T extends BaseTagObject>(props: MultiChipInputProps<T>) => {
  const {
    fetchSuggestions,
    compare = (a: BaseTagObject, b: BaseTagObject) => a.id === b.id,
    renderIcon,
    extractCat = (item: BaseTagObject) => item.category ?? 'general',
    onItemsChange,
    children,
  } = props

  const ChipsContext = createChipsContext<T>()
  const [items, setItems] = useState<T[]>([])
  const [suggestions, setSuggestions] = useState<T[]>([])

  const hasResults = useSharedValue(false)

  const renderIconElement = useCallback(renderIcon ?? defaultIconRender(extractCat), [
    renderIcon,
    extractCat,
  ])

  const { value: query } = useContext(FieldContext)

  useEffect(() => {
    if (fetchSuggestions) {
      fetchSuggestions().then((s) => {
        hasResults.set(s.length > 0)
        setSuggestions(s)
      })
    }
  }, [fetchSuggestions])

  useEffect(() => {
    if (fetchSuggestions) {
      fetchSuggestions(query).then((s) => {
        hasResults.set(s.length > 0)
        setSuggestions(s)
      })
    }
  }, [query])

  useEffect(() => {
    onItemsChange?.(items)
  }, [items])

  return (_: InputProps, ref: Ref<TextFieldHandle>) => (
    <ChipsContext.Provider
      value={{ items, setItems, suggestions, setSuggestions, hasResults, renderIconElement }}
    >
      {typeof children === 'function' ? (
        children(props, ref)
      ) : children ? (
        children
      ) : (
        <View>
          <MultiChipInput.Input<T> {...props} ref={ref} />
          <MultiChipInput.Suggestions<T> compare={compare} />
        </View>
      )}
    </ChipsContext.Provider>
  )
}

MultiChipInput._ForwardRef = <T extends BaseTagObject>(
  {
    floatingPlaceholderStyle,
    onChangeText,
    fetchSuggestions,
    compare = (a: T, b: T) => a.id === b.id,
    renderIcon,
    extractCat = (item: T) => item.category ?? 'general',
    onChange,
    onItemsChange,
    fetchItems,
    containerStyle,
    ...props
  }: MultiChipInputProps<T>,
  ref: Ref<TextFieldHandle>
) => {
  const { items, setItems, renderIconElement } = useChipContext<T>()

  const chips = useMemo(
    () =>
      items.map((t) => {
        return {
          label: t.name as string,
          id: t.id,
          leftElement: renderIconElement(t),
        }
      }),
    [items, renderIconElement]
  )

  return (
    <BadgeInputInner
      {...props}
      ref={ref}
      containerStyle={[{ zIndex: 1 }, containerStyle]}
      chips={chips}
      defaultChipProps={{
        leftElement: renderIconElement(),
      }}
      //@ts-ignore
      onChange={(newChips, changeReason, updatedChip) => {
        onChange?.(newChips, changeReason, updatedChip)
        if (changeReason === 'added') {
          const getUnique = (tags: T[]): Promise<T[]> => {
            const viableChips = newChips.filter((nc) => !tags.find((t) => t.name === nc.label))
            if (fetchItems) {
              return fetchItems(viableChips.map((nc) => ({ id: nc.id!, name: nc.label! })))
            }
            return Promise.resolve(
              viableChips.map((nc) => {
                return { name: nc.label!, id: nc.id! } as T
              })
            )
          }
          getUnique(items).then((newItems) => {
            setItems([...items, ...newItems])
          })
        } else if (changeReason === 'removed') {
          const filterTag = (tags: T[]) =>
            tags.filter((t) =>
              newChips.find((nc) => nc.label === t.name || (nc.id && nc.id === t.id))
            )
          if (newChips.length === 0) {
            setItems([])
          } else {
            setItems(filterTag(items))
          }
        }
      }}
    />
  )
}

MultiChipInput.Input = forwardRef(MultiChipInput._ForwardRef) as <T extends BaseTagObject>(
  props: MultiChipInputProps<T> & { ref?: Ref<TextFieldHandle> }
) => React.JSX.Element

MultiChipInput.Suggestions = <T extends BaseTagObject>(
  props: Pick<MultiChipInputProps<T>, 'compare'>
) => {
  const NUM_PRICE_ROWS = 2

  const { compare = (a: T, b: T) => a.id === b.id } = props
  const { items, setItems, suggestions, hasResults, renderIconElement } = useChipContext<T>()
  const context = useContext(FieldContext)
  const isFocused = context.isFocused

  const suggestionContainerStyle = useAnimatedStyle(() => {
    return {
      height: withTiming(
        isFocused && (suggestions.length || hasResults.get())
          ? BADGE_HEIGHT * NUM_PRICE_ROWS + (NUM_PRICE_ROWS - 1) * 4 + 60
          : 0
      ),
    }
  }, [isFocused, suggestions, hasResults])

  const rows = useMemo(
    () =>
      splitToNChunks(
        suggestions?.filter((s) => !items.find((t) => compare(t, s))) ?? [],
        NUM_PRICE_ROWS,
        3
      ).filter((r) => r.length > 0) as T[][],
    [suggestions, items]
  )

  return (
    <Animated.View
      style={[
        suggestionContainerStyle,
        {
          overflow: 'hidden',
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
            <Animated.View
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
                    entering={FadeIn.duration(75)}
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
            </Animated.View>
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
  )
}
