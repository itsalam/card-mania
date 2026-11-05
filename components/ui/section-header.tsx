import { BlurView } from 'expo-blur'
import { ChevronDown, LucideIcon } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { Text } from './text/base-text'

/**
 * Shared header row for feed-style content sections (see ITS-107): icon + title, with a
 * "See all" / "Show less" affordance when expandable. Sticky via the page ScrollView's
 * `stickyHeaderIndices`, so it needs its own backing or scrolled content would show through.
 *
 * Rendered as its own bordered box inside the section's frame (SectionFrameTop/Bottom): a blur
 * of whatever scrolls beneath (the Home background is a gradient, so a solid fill would
 * mismatch it), a translucent primary tint over the blur, and a hairline border. The box clips
 * the blur to its rounded shape, so unlike the old borderless header it needs no fade mask.
 */
export function SectionHeader({
  icon: Icon,
  title,
  isOpen,
  onToggle,
  expandable = true,
}: {
  icon?: LucideIcon
  title: string
  isOpen: boolean
  onToggle: () => void
  /** When false, this section has no expanded state — render the title row without the
   *  "See all"/chevron affordance and don't respond to taps. */
  expandable?: boolean
}) {
  return (
    <View
      style={{
        position: 'relative',
        // Rounded top, flat bottom edge — the bottom border reads as the line between header and
        // section content.
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.6),
      }}
    >
      <BlurView
        intensity={30}
        tint="default"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.3) },
        ]}
      />
      <Pressable
        onPress={expandable ? onToggle : undefined}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {Icon && <Icon size={22} color={Colors.$iconDefault} />}
          <Text variant="h3" numberOfLines={1}>
            {title}
          </Text>
        </View>
        {expandable && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text variant="small" style={{ color: Colors.$textNeutral }}>
              {isOpen ? 'Show less' : 'See all'}
            </Text>
            <ChevronDown
              size={16}
              color={Colors.$textNeutral}
              style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
            />
          </View>
        )}
      </Pressable>
    </View>
  )
}
