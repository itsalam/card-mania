import { cn } from '@/lib/utils/index'
import * as React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, TextProps } from './base-text'

export const SkeletonText = ({
  loading = true,
  children,
  style,
  onLayout,
  defaultDimensions,
  ...props
}: TextProps & { loading?: boolean; defaultDimensions?: { width: number; height: number } }) => {
  const [layout, setLayout] = React.useState<{ width: number; height: number } | null>(
    defaultDimensions ?? null
  )
  const [lineHeight, setLineHeight] = React.useState(0)
  const [lineWidth, setLineWidth] = React.useState(0)

  const isLoading = loading !== undefined ? loading : !Boolean(children)

  const effectiveHeight = Math.max(lineHeight ?? 0, layout?.height ?? 0)
  const effectiveWidth = lineWidth ?? layout?.width

  const styleHeights = React.useMemo(() => {
    if (!style) return []
    const sheet = StyleSheet.flatten(style)
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
            setLineWidth(e.nativeEvent.lines[0].width)
          }
          props.onTextLayout?.(e)
        }}
      >
        {children ?? 'Placeholder'}
      </Text>
      {isLoading && effectiveHeight > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: effectiveWidth,
            height: effectiveHeight,
          }}
          className={cn('bg-accent animate-pulse rounded-md')}
        />
      )}
    </View>
  )
}
