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

  return (
    <View style={containerStyle}>
      <Text
        ellipsizeMode="tail"
        {...props}
        numberOfLines={!expanded ? minNumLines : numberOfLines}
      />
      <TouchableOpacity onPress={() => setExpanded(!expanded)}>
        <Text {...props} style={{ color: Colors.$textGeneral }}>
          {expanded ? compressText : expandText}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
