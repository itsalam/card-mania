import { Text } from '@/components/ui/text/base-text'
import { LucideIcon } from 'lucide-react-native'
import { ReactNode, useState } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import Svg, { Path } from 'react-native-svg'

/** Corner tab: height (and minimum width) and the radius of its rounded corner and concave shoulders. */
export const CORNER_TAB_SIZE = 30
export const CORNER_TAB_RADIUS = 10

/**
 * A button drawn as a notch in a list item's corner, styled like the header's shoulder cutout
 * (components/ui/headers.tsx ShoulderCutout / Background.tsx cutPath): a tab hanging from the
 * corner, with a rounded inner corner and concave fillets where it meets the item's two edges.
 * The path is drawn for a top-left corner and mirrored into place. Purely visual — the caller
 * wraps it in its own pressable and positions it flush with the corner, inside the item's border.
 *
 * `outerRadius` rounds the tab's corner that sits in the item's own corner, so the fill follows
 * the item's rounded border instead of squaring it off. With a `label` the tab widens to fit;
 * `children` replaces the icon/label entirely (e.g. a list item's title block), and the tab
 * sizes to them. `leadingShoulder={false}` drops the fillet along the item's top/bottom edge, for
 * a tab whose inner side butts against other content (the art) rather than open edge.
 */
export function CornerTab({
  icon: Icon,
  label,
  children,
  corner = 'top-right',
  tone = 'primary',
  outerRadius = 0,
  leadingShoulder = true,
  radius = CORNER_TAB_RADIUS,
  style,
}: {
  icon?: LucideIcon
  label?: string
  children?: ReactNode
  corner?: 'top-right' | 'bottom-right'
  tone?: 'primary' | 'neutral'
  outerRadius?: number
  leadingShoulder?: boolean
  /** Radius of the tab's rounded corner and shoulder fillets. */
  radius?: number
  style?: StyleProp<ViewStyle>
}) {
  const T = CORNER_TAB_SIZE
  const R = radius
  const isBottom = corner === 'bottom-right'
  // Tab size follows its content; measured, since the path needs numbers.
  const [{ W, H }, setSize] = useState({ W: T, H: T })
  const ro = Math.min(outerRadius, H)
  const L = leadingShoulder ? R : 0
  // The tab's exposed edge: top shoulder → inner side → rounded corner → bottom → left shoulder.
  const edge = [
    // Concave shoulder along the top edge. Without one, the stroke starts at the rounded corner:
    // the inner side butts against other content, so a line there would box the tab off from it.
    leadingShoulder ? `M${W + R} 0 A${R} ${R} 0 0 0 ${W} ${R} L${W} ${H - R}` : `M${W} ${H - R}`,
    // Convex bottom-right corner of the tab.
    `A${R} ${R} 0 0 1 ${W - R} ${H}`,
    `L${R} ${H}`,
    // Concave shoulder down the left edge.
    `A${R} ${R} 0 0 0 0 ${H + R}`,
  ].join(' ')
  // Fill closes the shape back along the item's own edges (which already carry its border),
  // rounding the item's corner.
  const fill = `${edge} L0 ${ro} A${ro} ${ro} 0 0 1 ${ro} 0 Z`
  const tint =
    tone === 'primary'
      ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.2)
      : Colors.rgba(Colors.$backgroundNeutral, 0.6)
  return (
    <View
      style={[
        { paddingLeft: L, paddingTop: isBottom ? R : 0, paddingBottom: isBottom ? 0 : R },
        style,
      ]}
      pointerEvents={children ? 'box-none' : 'none'}
    >
      <Svg
        width={W + L}
        height={H + R}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scaleX: -1 }, ...(isBottom ? [{ scaleY: -1 }] : [])] },
        ]}
      >
        {/* Opaque base so the photo/title never shows through, then the tone's tint, and a
            hairline matching the item's own border. */}
        <Path d={fill} fill={Colors.$backgroundElevated} />
        <Path d={fill} fill={tint} />
        <Path d={edge} fill="none" stroke={Colors.$outlineNeutral} strokeWidth={1} />
      </Svg>
      <View
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setSize({ W: Math.max(T, Math.ceil(width)), H: Math.max(T, Math.ceil(height)) })
        }}
        style={
          children
            ? { minWidth: T, minHeight: T }
            : {
                minWidth: T,
                height: T,
                paddingHorizontal: label ? 10 : 0,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }
        }
      >
        {children ?? (
          <>
            {Icon && <Icon size={14} color={Colors.$iconDefault} />}
            {label && (
              <Text variant="small" style={{ fontSize: 12, fontWeight: '600' }}>
                {label}
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  )
}
