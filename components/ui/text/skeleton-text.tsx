import { cn } from '@/lib/utils/index'
import * as React from 'react'
import { StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { Text, TextProps } from './base-text'

export const SkeletonText = ({
  loading = true,
  children,
  style,
  onLayout,
  defaultDimensions,
  placeholderTextLength: placeholderTextSize,
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

  const effectiveHeight = Math.max(lineHeight ?? 0)
  const effectivePadding = Math.max(lineHeight - fontSize, 0)

  const styleHeights = React.useMemo(() => {
    if (!style) return []
    const sheet = StyleSheet.flatten(style)
    setFontSize(sheet.fontSize ?? 0)
    return [sheet.lineHeight, sheet.fontSize].filter(Boolean) as number[]
  }, [style])

  return (
    <View style={{ minHeight: layout?.height }}>
      <Text
        {...props}
        style={[style, isLoading ? { opacity: 0 } : undefined]}
        onLayout={(e) => {
          setLayout(e.nativeEvent.layout)
          onLayout?.(e)
        }}
        onTextLayout={(e) => {
          if (e.nativeEvent.lines.length > 0) {
            setLineHeight(Math.max(...e.nativeEvent.lines.map((l) => l.height, ...styleHeights)))
            setLineWidths(e.nativeEvent.lines.map((l) => l.width))
          }
          props.onTextLayout?.(e)
        }}
      >
        {(children ?? placeholderTextSize)
          ? Array(placeholderTextSize).fill('A').join('')
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
