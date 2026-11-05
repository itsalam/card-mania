import { ReactNode } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'

/**
 * Full-width band that wraps an expandable feed section (header + body) as one block, edge to
 * edge like the home ticker tape: the header's own bordered box (SectionHeader) flush across the
 * top, and a hairline closing off the bottom.
 *
 * Feed/Explore sections render their header and body as *separate* children of the page
 * ScrollView so headers can stick via `stickyHeaderIndices` — a single wrapping View would break
 * that. So the band is drawn in two halves that meet: SectionFrameTop around the header,
 * SectionFrameBottom (bottom hairline) around the body. Use them as a pair.
 */
/** Horizontal space the frame takes from its content (no side margin or side border). */
export const SECTION_FRAME_INSET = 0
const FRAME_PADDING = 8

const frameBorder = () => ({
  borderColor: Colors.rgba(Colors.$outlineNeutral, 0.6),
})

export function SectionFrameTop({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View
      style={[
        // No padding: the header box sits flush in the band, and its own top border is the
        // band's top edge (a frame hairline here would double up against it).
        { marginTop: 8 },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function SectionFrameBottom({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View
      style={[
        {
          marginBottom: 16,
          paddingBottom: FRAME_PADDING,
          borderBottomWidth: 1,
        },
        frameBorder(),
        style,
      ]}
    >
      {children}
    </View>
  )
}
