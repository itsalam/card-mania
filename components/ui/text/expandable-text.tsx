import * as React from 'react'
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { Text, TextProps } from './base-text'

export const ExpandableText = ({
  minNumLines,
  containerStyle,
  numberOfLines,
  expandText = 'See More',
  compressText = 'See Less',
  ...props
}: TextProps & {
  expandText?: string
  compressText?: string
  containerStyle?: StyleProp<ViewStyle>
  minNumLines: number
}) => {
  const [expanded, setExpanded] = React.useState(false)
  const [isTruncatable, setIsTruncatable] = React.useState(false)

  return (
    <View style={[containerStyle, { overflow: 'hidden' }]}>
      {/* Absolutely-positioned invisible text with no line limit — measures true line count */}
      <Text
        {...props}
        numberOfLines={undefined}
        style={[props.style, { position: 'absolute', opacity: 0, top: 0, left: 0, right: 0 }]}
        onTextLayout={(e) => {
          setIsTruncatable(e.nativeEvent.lines.length > minNumLines)
        }}
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      />
      <Text
        ellipsizeMode="tail"
        {...props}
        numberOfLines={expanded ? numberOfLines : minNumLines}
      />
      {isTruncatable && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <Text {...props} style={{ color: Colors.$textGeneral }}>
            {expanded ? compressText : expandText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
