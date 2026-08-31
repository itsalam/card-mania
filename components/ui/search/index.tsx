import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { Search, SlidersHorizontal } from 'lucide-react-native'
import { MotiView } from 'moti'
import { cssInterop } from 'nativewind'
import React, {
  ComponentProps,
  ComponentRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ActivityIndicator,
  Animated,
  ImageStyle,
  StyleProp,
  StyleSheet,
  TextInput,
  TextStyle,
  ViewStyle,
} from 'react-native'
import {
  Assets,
  SearchInput as BaseSearchInput,
  BorderRadiuses,
  Button,
  Colors,
  Constants,
  Spacings,
  TouchableOpacity,
  Typography,
  View,
} from 'react-native-ui-lib'
import { inputStyle, inputStyleSheet, InputVariantProps } from '../input'

const ICON_SIZE = 18
const INPUT_HEIGHT = 44
const TOP_INPUT_HEIGHT = Constants.isIOS ? 38 : 44
const PROMINENT_INPUT_HEIGHT = 44
const HIT_SLOP_VALUE = 20

const OptionsButton = ({ onPress, color }: { onPress?: () => void; color: string }) => {
  return (
    <TouchableOpacity hitSlop={20} onPress={onPress}>
      <SlidersHorizontal size={18} color={color} />
    </TouchableOpacity>
  )
}

export type SearchInputProps = Omit<ComponentProps<typeof BaseSearchInput>, 'style'> & {
  onLeftIconPress?: () => void
  leftIconStyle?: StyleProp<ImageStyle>
  style?: StyleProp<ViewStyle>
}

export type SearchBarProps = SearchInputProps &
  InputVariantProps & {
    onOptionsPress?: () => void
    renderSideButton?: ({ onPress }: { onPress?: () => void }) => React.ReactNode
    hideSideButton?: boolean
  }

type SearchBarRef = ComponentRef<typeof BaseSearchInput> & {
  focus?: () => void
  blur?: () => void
  clear?: () => void
  isFocused?: () => boolean
}

export const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(
  (
    {
      className,
      onOptionsPress,
      renderSideButton,
      hideSideButton,
      variant = 'outline',
      size = 'search',
      style,
      ...props
    },
    ref
  ) => {
    let rightEl: React.ReactElement | undefined
    if (!hideSideButton) {
      const props = { onPress: onOptionsPress, color: Colors.$textDefault }
      if (!renderSideButton) {
        rightEl = <OptionsButton {...props} />
      } else if (React.isValidElement(renderSideButton)) {
        // @ts-ignore
        rightEl = React.cloneElement(renderSideButton, props)
      } else if (typeof renderSideButton === 'function') {
        const el = renderSideButton(props)
        rightEl = React.isValidElement(el) ? el : <>{el as React.ReactNode}</>
      } else {
        const Comp = renderSideButton as React.ComponentType<{ onPress?: () => void }>
        rightEl = <Comp {...props} />
      }
    }

    return (
      <SearchInput
        ref={ref}
        placeholderTextColor={Colors.$textNeutralLight}
        containerStyle={{
          fontSize: 20,
        }}
        customRightElement={rightEl}
        style={[
          {
            display: 'flex',
            alignItems: 'center',
            borderRadius: 9999,
            position: 'relative',
            padding: 0,
          },
          inputStyleSheet({ variant, size }).containerStyle,
          style,
        ]}
        className={inputStyle({ variant, size, class: className })}
        {...props}
      />
    )
  }
)

// Must match collapsedSearchIconButtonStyle's height below so the animated width converges on
// exactly the same value the collapsed button style renders at rest — this is also the exact
// pixel value SearchBar's `size="sm"` variant (Tailwind `h-9`) compiles to (see
// components/ui/input/index.tsx). Consumers MUST pass `size="sm"` alongside this style: rather
// than fight NativeWind's cssInterop over which of the className-derived height vs. this style's
// explicit height wins, both are set to agree on the same number so it doesn't matter which one
// "wins" — a mismatch here (e.g. a consumer forgetting size="sm" and getting `size="search"`'s
// h-16/64px by default) is what previously produced an oversized, off-center-looking button.
const COLLAPSED_SEARCH_WIDTH = 36

// Shared "collapsed search icon" chrome for any <ExpandableSearchBar> consumer (Collection's
// header, Home's header) — matches Marketplace's header icon button (`filterButton` in
// features/marketplace/index.tsx: same 8px padding, pill radius, translucent bg/border) so every
// header icon button reads as one system. Sized as icon (18px, SearchInput's fixed ICON_SIZE) +
// 8px padding per side, vs. Marketplace's 16px icon + 8px padding — same padding amount, box
// scales with the (slightly larger) glyph it contains.
//
// Consumers must also pass size="sm" (see COLLAPSED_SEARCH_WIDTH above) and hideSideButton — the
// latter because SearchBar always renders a second (options/filter) icon via customRightElement
// unless told not to; left un-hidden, that button was cramming into this same tiny collapsed
// width alongside the search icon.
//
// No width here — pass it via ExpandableSearchBar, whose inner MotiView animates width directly
// and gives its child `width: '100%'`, so the button tracks that animation continuously instead
// of jumping to a fixed size the instant this style toggles in/out.
//
// paddingLeft/paddingRight/paddingVertical are explicit (rather than justifyContent: 'center')
// because SearchInput's text-input area always has flex: 1 internally — even while visually
// collapsed, it still claims all leftover width in this row, so justifyContent has nothing left
// to center with and the icon just sits flush against the row's own left edge. paddingLeft: 8
// gives the icon real breathing room on the left; the phantom flex:1 input then fills the
// remaining space on the right (clipped by overflow: hidden).
export const collapsedSearchIconButtonStyle = {
  height: COLLAPSED_SEARCH_WIDTH,
  paddingLeft: 8,
  paddingRight: 0,
  paddingVertical: 0,
  alignItems: 'center' as const,
  justifyContent: 'flex-start' as const,
  borderRadius: 999,
  backgroundColor: Colors.rgba(Colors.$backgroundNeutral, 1),
  borderWidth: 1,
  borderColor: Colors.rgba(Colors.$outlineNeutral, 1),
  overflow: 'hidden' as const,
}

export const ExpandableSearchBar = (props: SearchBarProps & { expanded: boolean }) => {
  const { expanded, style, ...rest } = props
  // Measured, not assumed — the row this sits in also holds the header title, so "full width"
  // isn't a static value we can compute from screen width alone.
  const [containerWidth, setContainerWidth] = useState(COLLAPSED_SEARCH_WIDTH)

  return (
    <MotiView
      // box-none: this wrapper is sized width: '100%' of its row (needed so the collapsed
      // circle can grow into a full-width pill), which spans well beyond its own visible
      // content — without this, its empty area sits on top of (and swallows touches meant for)
      // whatever else shares that row, e.g. Collection's header title to its left.
      pointerEvents="box-none"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row-reverse',
        // Explicit center: without this, RN's default cross-axis 'stretch' makes the inner
        // MotiView fill this box's full height, but that inner box's own row-direction children
        // (icon + text input) never re-center within a stretched ancestor — they just sit
        // top-aligned inside it. Centering here instead lets the inner content size to its own
        // intrinsic height and be centered as a block, so collapsed vs. expanded stay aligned.
        alignItems: 'center',
        marginVertical: 'auto',
        top: 0,
        right: 0,
      }}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width)
        if (w > 0 && w !== containerWidth) setContainerWidth(w)
      }}
    >
      <MotiView
        style={{
          overflow: 'visible',
        }}
        // Animate an explicit width (measured containerWidth <-> COLLAPSED_SEARCH_WIDTH) rather
        // than `flex` — flex only animates this box's *share* of its parent, so the actual pixel
        // width still had to jump discretely whenever collapsedSearchIconButtonStyle's own fixed
        // width toggled in/out on the child below, producing a visible snap right as the flex
        // animation finished. A single animated width value removes that second, uncoordinated
        // source of truth. Mirrors ExpandableSearchBar's web implementation (index.web.tsx), which
        // uses the same measured-width technique for the same reason.
        animate={{
          width: expanded ? containerWidth : COLLAPSED_SEARCH_WIDTH,
          borderColor: Colors.rgba(Colors.$iconNeutral, expanded ? 1 : 0),
          borderRadius: expanded ? BorderRadiuses.br100 : BorderRadiuses.br40,
          borderWidth: 1,
        }}
      >
        <SearchBar style={[{ width: '100%' }, style]} {...rest} />
      </MotiView>
    </MotiView>
  )
}

const SearchInput = forwardRef<ComponentRef<typeof BaseSearchInput>, SearchInputProps>(
  (props, ref) => {
    const colorScheme = useEffectiveColorScheme()
    const INVERTED_TEXT_COLOR = Colors.$textDefaultLight
    const INVERTED_ICON_COLOR = Colors.$iconDefaultLight
    const styles = useMemo(
      () =>
        StyleSheet.create({
          componentContainer: {
            paddingHorizontal: Spacings.s3,
          },
          icon: {},
          leftIcon: {},
          inputContainer: {
            height: INPUT_HEIGHT,
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            overflow: 'hidden',
          },
          prominentContainer: {
            borderWidth: 1,
            borderColor: Colors.$outlineDefault,
            borderRadius: BorderRadiuses.br20,
            marginHorizontal: Spacings.s5,
          },
          input: {
            flex: 1,
            paddingLeft: Spacings.s2,
            ...Typography.body,
            lineHeight: undefined,
            color: Colors.$textDefault,
            textAlign: Constants.isRTL ? 'right' : 'left',
          },
          emptyInput: {
            marginRight: Spacings.s4,
          },
          cancelButton: {
            marginLeft: Spacings.s4,
            marginRight: Spacings.s4,
          },
          clearButton: {
            marginRight: Spacings.s4,
          },
        }),
      [colorScheme]
    )
    const {
      preset = 'default',
      onDismiss,
      useSafeArea,
      invertColors,
      testID,
      showLoader,
      loaderProps,
      value: controlledValue,
      onChangeText,
      onClear,
      containerStyle,
      customRightElement,
      style,
      inaccessible,
      onFocus,
      onBlur,
      onLeftIconPress,
      leftIconStyle,
      ...restProps
    } = props

    const currentAnimatedValue = useRef<Animated.CompositeAnimation>(null)
    const searchInputRef = useRef<TextInput>(null)
    const [hasValue, setHasValue] = useState(Boolean(controlledValue))
    const [value, setValue] = useState(controlledValue)
    const [valueState] = useState(new Animated.Value(!!controlledValue?.length ? 0 : 1))
    const [isAnimatingClearButton, setIsAnimatingClearButton] = useState(!!controlledValue?.length)
    useImperativeHandle(ref, () => {
      const input = searchInputRef.current
      if (!input) {
        return null as unknown as SearchBarRef
      }

      // Capture the original methods so we don't recursively call the overridden ones.
      const focus = input.focus?.bind(input)
      const blur = input.blur?.bind(input)
      const clear = input.clear?.bind(input)
      const isFocused = input.isFocused?.bind(input)

      return Object.assign(input, {
        focus: () => focus?.(),
        blur: () => blur?.(),
        clear: () => {
          clear?.()
          onChangeText?.('')
          onClear?.()
        },
        isFocused: () => isFocused?.(),
      })
    }, [onChangeText, onClear])
    useEffect(() => {
      if (controlledValue !== value) {
        setValue(controlledValue)
        setHasValue(Boolean(controlledValue))
      }
    }, [controlledValue])
    useEffect(() => {
      if (hasValue) {
        animatedValueState(1)
      } else {
        animatedValueState(0)
      }
    }, [hasValue])
    useEffect(() => {
      return () => {
        currentAnimatedValue.current?.stop()
      }
    }, [])
    const animatedValueState = (value: number) => {
      setIsAnimatingClearButton(true)
      if (currentAnimatedValue.current) {
        currentAnimatedValue.current.stop()
      }
      currentAnimatedValue.current = Animated.timing(valueState, {
        toValue: value,
        duration: 160,
        useNativeDriver: true,
      })
      currentAnimatedValue.current.start(() => {
        if (!hasValue) {
          setIsAnimatingClearButton(false)
        }
      })
    }
    const getHeight = () => {
      const isProminent = preset === 'prominent'
      if (isProminent) {
        return PROMINENT_INPUT_HEIGHT
      }
      return useSafeArea ? TOP_INPUT_HEIGHT : INPUT_HEIGHT
    }
    const onChangeTextHandler = (text: string) => {
      onChangeText?.(text)
      setValue(text)
      setHasValue(!(text.length === 0))
    }
    const clearInput = () => {
      searchInputRef?.current?.clear?.()
      onChangeTextHandler('')
      onClear?.()
    }
    const renderClearButton = () => {
      const transform = [
        {
          translateY: valueState.interpolate({
            inputRange: [0, 1],
            outputRange: [10, 1],
          }),
        },
      ]
      const clearButtonStyle = !isDismissible() && isAnimatingClearButton && styles.clearButton
      const iconStyle = {
        tintColor: Colors.$iconDefault,
        width: 12,
        height: 12,
      }
      return (
        <Animated.View
          style={[
            {
              transform,
              opacity: valueState,
            },
            clearButtonStyle,
          ]}
        >
          <Button
            link
            iconSource={Assets.internal.icons.x}
            iconStyle={iconStyle}
            onPress={clearInput}
            hitSlop={HIT_SLOP_VALUE}
            accessible={Boolean(hasValue)}
            accessibilityLabel={'clear'}
            testID={`${testID}.clearButton`}
          />
        </Animated.View>
      )
    }
    const renderCancelButton = () => {
      const { cancelButtonProps } = props
      if (onDismiss) {
        return (
          <Button
            style={styles.cancelButton}
            link
            color={invertColors ? INVERTED_TEXT_COLOR : undefined}
            $textDefault
            text65M
            {...cancelButtonProps}
            onPress={onDismiss}
            testID={`${testID}.cancelButton`}
          />
        )
      }
    }
    const renderTextInput = () => {
      const { placeholder } = props
      const height = getHeight()
      const placeholderTextColor = invertColors ? INVERTED_TEXT_COLOR : Colors.$textDefault
      const selectionColor = invertColors ? INVERTED_TEXT_COLOR : Colors.$textDefault
      return (
        <View
          style={[
            styles.inputContainer,
            {
              height,
            },
          ]}
        >
          <TextInput
            accessibilityRole={'search'}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor}
            underlineColorAndroid="transparent"
            selectionColor={selectionColor}
            ref={searchInputRef}
            value={value}
            allowFontScaling={false}
            style={[
              styles.input,
              containerStyle as StyleProp<TextStyle>,
              invertColors && {
                color: INVERTED_TEXT_COLOR,
              },
              (!isDismissible() || isAnimatingClearButton) && styles.emptyInput,
            ]}
            onChangeText={onChangeTextHandler}
            testID={testID}
            onFocus={onFocus}
            onBlur={onBlur}
            {...restProps}
          />
          {isAnimatingClearButton && renderClearButton()}
          {isDismissible() && renderCancelButton()}
          {!isDismissible() && customRightElement}
        </View>
      )
    }
    const isDismissible = () => {
      return typeof onDismiss !== 'undefined'
    }
    // The right-side icon (SlidersHorizontal, in OptionsButton) is a lucide-react-native SVG icon
    // — rendering the left search icon through react-native-ui-lib's asset-based Icon instead
    // (a raster/vector asset with its own baked-in canvas padding) made the two sides look
    // unevenly spaced even with identical numeric layout padding. Using the same lucide icon set
    // for both keeps their optical weight and internal glyph bounds consistent.
    const renderIcon = (onPress?: () => void, style?: StyleProp<ImageStyle>) => {
      // Colors.$iconDefaultLight (used elsewhere in this file as INVERTED_ICON_COLOR) is meant
      // for dark/inverted surfaces and renders near-white — using it here for the default,
      // non-inverted case was the source of the icon rendering white regardless of theme.
      // Colors.$textDefault matches the right-side icon's own color (OptionsButton in SearchBar,
      // above) so both stay visually consistent and theme-aware.
      const color = invertColors ? INVERTED_ICON_COLOR : Colors.$textDefault

      return (
        <TouchableOpacity
          onPress={() => {
            onPress?.()
          }}
        >
          <Search color={color} size={ICON_SIZE} strokeWidth={2} style={[styles.leftIcon, style]} />
        </TouchableOpacity>
      )
    }
    const renderLoader = () => {
      const { customLoader } = props
      return (
        <View>
          {customLoader ? (
            customLoader
          ) : (
            <ActivityIndicator style={styles.loader} {...loaderProps} />
          )}
        </View>
      )
    }
    const topInputTopMargin = useSafeArea && {
      marginTop: Constants.isIOS ? Constants.statusBarHeight : 0,
    }
    const isProminent = preset === 'prominent'
    return (
      <View
        inaccessible={inaccessible}
        row
        centerV
        style={[
          styles.componentContainer,
          style,
          isProminent && styles.prominentContainer,
          topInputTopMargin,
        ]}
        testID={`${testID}.searchBox`}
      >
        {showLoader ? renderLoader() : renderIcon(onLeftIconPress, leftIconStyle)}
        {renderTextInput()}
      </View>
    )
  }
)

SearchInput.displayName = 'SearchInput'

cssInterop(SearchInput, {
  className: {
    target: 'style',
  },
})

SearchBar.displayName = 'SearchBar'
