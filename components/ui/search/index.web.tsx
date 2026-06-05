import { Search, SlidersHorizontal, X } from 'lucide-react-native'
import { MotiView } from 'moti'
import React, { forwardRef, useState } from 'react'
import {
  Pressable,
  StyleProp,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native'
import { Colors } from 'react-native-ui-lib'

type SideButtonProps = { onPress?: () => void; color?: string }

export type SearchBarProps = {
  value?: string
  onChangeText?: (text: string) => void
  placeholder?: string
  placeholderTextColor?: string
  autoFocus?: boolean
  /** Called when the left search icon is pressed */
  onLeftIconPress?: () => void
  style?: StyleProp<ViewStyle>
  inputStyle?: StyleProp<TextStyle>
  hideSideButton?: boolean
  onOptionsPress?: () => void
  renderSideButton?: (props: SideButtonProps) => React.ReactNode
  textOpacity?: number
  [key: string]: any
}

export type SearchInputProps = SearchBarProps

// Collapsed width — just enough to show the search icon as a circle.
const ICON_SLOT = 38

export const SearchBar = forwardRef<TextInput, SearchBarProps>(
  (
    {
      value,
      onChangeText,
      placeholder,
      placeholderTextColor,
      autoFocus,
      onLeftIconPress,
      style,
      inputStyle: inputStyleProp,
      hideSideButton,
      onOptionsPress,
      renderSideButton,
      textOpacity,
      ...rest
    },
    ref
  ) => {
    const [focused, setFocused] = useState(false)
    const { onFocus: onFocusProp, onBlur: onBlurProp, ...textInputRest } = rest

    let rightEl: React.ReactNode = null
    if (!hideSideButton) {
      const btnProps: SideButtonProps = { onPress: onOptionsPress, color: Colors.$textNeutralLight }
      if (typeof renderSideButton === 'function') {
        rightEl = renderSideButton(btnProps)
      } else {
        rightEl = (
          <Pressable onPress={onOptionsPress} hitSlop={8} style={{ padding: 4 }}>
            <SlidersHorizontal size={15} color={Colors.$textNeutralLight} />
          </Pressable>
        )
      }
    }

    return (
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 9999,
            borderWidth: 1,
            borderColor: focused ? Colors.$textNeutral : Colors.$outlineDefault,
            paddingHorizontal: 10,
            height: ICON_SLOT,
            gap: 8,
            backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.9),
            // overflow hidden ensures content is clipped to the pill/circle shape
            overflow: 'hidden',
            // @ts-ignore — web-only transition
            transition: 'border-color 0.15s ease',
          },
          style,
        ]}
      >
        {/* Search icon — pressable to expand when inside ExpandableSearchBar */}
        <Pressable onPress={onLeftIconPress} hitSlop={8} style={{ flexShrink: 0 }}>
          <Search
            size={15}
            color={focused ? Colors.$textDefault : Colors.$textNeutralLight}
            strokeWidth={2.5}
          />
        </Pressable>

        <MotiView
          animate={{ opacity: textOpacity ?? 1 }}
          transition={{ type: 'timing', duration: 120 }}
          style={{ flex: 1 }}
        >
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor ?? Colors.$textNeutralLight}
            autoFocus={autoFocus}
            onFocus={(e) => {
              setFocused(true)
              onFocusProp?.(e as any)
            }}
            onBlur={(e) => {
              setFocused(false)
              onBlurProp?.(e as any)
            }}
            style={[
              {
                flex: 1,
                fontSize: 14,
                lineHeight: 20,
                color: Colors.$textDefault,
                paddingVertical: 0,
                // @ts-ignore — removes browser native focus blue ring
                outlineStyle: 'none',
              },
              inputStyleProp,
            ]}
            {...textInputRest}
          />
        </MotiView>

        {rightEl}
      </View>
    )
  }
)
SearchBar.displayName = 'SearchBar'

/**
 * Expandable search bar for web portrait mode.
 *
 * The outer View is flex:1 and acts as a measurement anchor.
 * The inner MotiView is absolutely positioned (right:0) and animates
 * its own *width* from ICON_SLOT (38px circle) to the full container
 * width (pill). Because the SearchBar inside has width:'100%', the
 * border-radius naturally transitions from circle → pill shape.
 * Expansion grows leftward.
 *
 * The X dismiss button lives inside the pill (renderSideButton) so
 * it's revealed as part of the expanding animation.
 */
export const ExpandableSearchBar = forwardRef<
  TextInput,
  SearchBarProps & { expanded: boolean; onDismiss?: () => void }
>(({ expanded, style, onLeftIconPress, onDismiss, ...rest }, ref) => {
  const { width: screenWidth } = useWindowDimensions()
  // Seed with a screen-based estimate so the first render is close.
  const [containerWidth, setContainerWidth] = useState(() => Math.round(screenWidth * 0.55))

  return (
    <View
      style={{ flex: 1, position: 'relative', height: ICON_SLOT }}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width)
        if (w > 0 && w !== containerWidth) setContainerWidth(w)
      }}
    >
      <MotiView
        animate={{ width: expanded ? containerWidth : ICON_SLOT }}
        transition={{ type: 'spring', damping: 100, stiffness: 800 }}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0 }}
      >
        <SearchBar
          ref={ref}
          onLeftIconPress={onLeftIconPress}
          hideSideButton={!expanded}
          textOpacity={expanded ? 1 : 0}
          renderSideButton={
            expanded
              ? ({ onPress }: SideButtonProps) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable onPress={onPress} hitSlop={8} style={{ padding: 4 }}>
                      <SlidersHorizontal size={15} color={Colors.$textNeutralLight} />
                    </Pressable>
                    {onDismiss && (
                      <Pressable onPress={onDismiss} hitSlop={8} style={{ padding: 4 }}>
                        <X size={15} color={Colors.$textNeutralLight} />
                      </Pressable>
                    )}
                  </View>
                )
              : undefined
          }
          style={[{ width: '100%' }, style]}
          {...rest}
        />
      </MotiView>
    </View>
  )
})
ExpandableSearchBar.displayName = 'ExpandableSearchBar'
