import { cn } from '@/lib/utils/index'
import * as React from 'react'
import { StyleSheet, TextLayoutEvent, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { Text, TextProps, VARIANT_FONT_STYLES } from './base-text'

export const SkeletonText = ({
  loading = true,
  children,
  style,
  onLayout,
  defaultDimensions,
  placeholderTextLength,
  variant,
  ...props
}: TextProps & {
  loading?: boolean
  defaultDimensions?: { width: number; height: number }
  placeholderTextLength?: number
}) => {
  const [layout, setLayout] = React.useState<{ width: number; height: number } | null>(
    defaultDimensions ?? null
  )
  const [lineHeight, setLineHeight] = React.useState(0)
  const [lineWidths, setLineWidths] = React.useState([0])
  const [fontSize, setFontSize] = React.useState(0)

  const isLoading = loading !== undefined ? loading : !Boolean(children)

  const effectiveHeight = React.useMemo(() => Math.max(lineHeight ?? 0), [lineHeight])
  const effectivePadding = React.useMemo(
    () => Math.max(lineHeight - fontSize, 2),
    [lineHeight, fontSize]
  )

  const styleHeights = React.useMemo(() => {
    const sheet = style ? StyleSheet.flatten(style) : {}
    const variantDefaults = VARIANT_FONT_STYLES[variant ?? 'default'] ?? {}
    const resolvedFontSize = sheet.fontSize ?? variantDefaults.fontSize ?? 0
    const resolvedLineHeight = sheet.lineHeight ?? variantDefaults.lineHeight ?? 0
    setFontSize(resolvedFontSize)
    return [resolvedLineHeight, resolvedFontSize].filter(Boolean) as number[]
  }, [style, variant])

  const onTextLayout = React.useCallback(
    (e: TextLayoutEvent) => {
      if (e.nativeEvent.lines.length > 0) {
        setLineHeight(Math.max(...e.nativeEvent.lines.map((l) => l.height), ...styleHeights))
        setLineWidths(e.nativeEvent.lines.map((l) => l.width))
      }
      props.onTextLayout?.(e)
    },
    [styleHeights]
  )

  return (
    <View style={{ minHeight: layout?.height }}>
      <Text
        {...props}
        variant={variant}
        style={[style, isLoading ? { opacity: 0 } : undefined]}
        onLayout={(e) => {
          setLayout(e.nativeEvent.layout)
          onLayout?.(e)
        }}
        onTextLayout={onTextLayout}
      >
        {children
          ? children
          : placeholderTextLength
            ? Array(placeholderTextLength).fill('_').join('')
            : 'Placeholder'}
      </Text>
      {isLoading && effectiveHeight > 0 && (
        <View
          style={{
            position: 'absolute',
            overflow: 'hidden',
            flexDirection: 'column',
            gap: effectivePadding / 2,
          }}
        >
          {lineWidths.map((width, idx) => (
            <View
              key={`${idx}-${width}`}
              style={{
                width: width,
                height: effectiveHeight - effectivePadding,
                backgroundColor: Colors.$backgroundDisabled,
              }}
              className={cn('animate-pulse rounded-md')}
            />
          ))}
        </View>
      )}
    </View>
  )
}
