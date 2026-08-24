import { Text } from '@/components/ui/text/base-text'
import React, { ReactNode } from 'react'
import { StyleProp, TextStyle, View, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'

/** Shared section-header label for a group of collections — used by both the
 *  Collection tab's default view (Collections / My Collections / Shared with me)
 *  and the Add-to-Collection view (Saved In / Other Collections). */
export const CollectionGroupLabel = ({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<TextStyle>
}) => (
  <Text variant="stats-header" style={[{ color: Colors.$textNeutral, letterSpacing: 0.8 }, style]}>
    {children}
  </Text>
)

/** Shared vertical list container for a group of collection rows — standardizes the
 *  spacing between rows across both the default Collection view and Add-to-Collection. */
export const CollectionGroupList = ({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) => <View style={[{ gap: 10 }, style]}>{children}</View>
