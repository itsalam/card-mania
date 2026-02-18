import { SlidersHorizontal } from 'lucide-react-native'
import { cssInterop } from 'nativewind'
import React, {
  ComponentProps,
  ComponentRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
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
  Icon,
  Spacings,
  TouchableOpacity,
  Typography,
  View,
} from 'react-native-ui-lib'
import { ImageSourceType } from 'react-native-ui-lib/src/components/image'
import { inputStyle, inputStyleSheet, InputVariantProps } from '../input'

const ICON_SIZE = 24
const INPUT_HEIGHT = 60
const TOP_INPUT_HEIGHT = Constants.isIOS ? 40 : 56
const PROMINENT_INPUT_HEIGHT = 48
const INVERTED_TEXT_COLOR = Colors.$textDefaultLight
const INVERTED_ICON_COLOR = Colors.$iconDefaultLight
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

const SearchInput = forwardRef<ComponentRef<typeof BaseSearchInput>, SearchInputProps>(
  (props, ref) => {
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
    const renderIcon = (
      icon: ImageSourceType,
      left = true,
      onPress?: () => void,
      style?: StyleProp<ImageStyle>
    ) => {
      const invertedColor = invertColors
        ? {
            tintColor: INVERTED_ICON_COLOR,
          }
        : undefined

      return (
        <TouchableOpacity
          onPress={() => {
            onPress?.()
          }}
        >
          <Icon
            tintColor={Colors.$textDefault}
            style={[styles.icon, invertedColor, left && styles.leftIcon, style]}
            source={icon}
            size={ICON_SIZE}
          />
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
        {showLoader
          ? renderLoader()
          : renderIcon(Assets.internal.icons.search, true, onLeftIconPress, leftIconStyle)}
        {renderTextInput()}
      </View>
    )
  }
)
const styles = StyleSheet.create({
  componentContainer: {
    paddingHorizontal: Spacings.s4,
  },
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
})

cssInterop(SearchInput, {
  className: {
    target: 'style',
  },
})

SearchBar.displayName = 'SearchBar'
