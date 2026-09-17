import MaskedView from '@react-native-masked-view/masked-view'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronDown, LucideIcon } from 'lucide-react-native'
import { useState } from 'react'
import { LayoutChangeEvent, Pressable, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { Text } from './text/base-text'

/**
 * Shared header row for feed-style content sections (see ITS-107): icon + title, with a
 * "See all" / "Show less" affordance when expandable. Sticky via the page ScrollView's
 * `stickyHeaderIndices`, so it needs its own backing or scrolled content would show through.
 *
 * Backed by a blur (not a solid color) since the Home screen's background is a gradient, not a
 * flat color — a solid fill would mismatch it. The blur is measured via onLayout rather than
 * `position:absolute` insets (MaskedView doesn't size reliably off insets alone — see
 * fade-scroll.tsx), and kept to exactly the header's own height with no overshoot, since RN
 * gives every sticky index `zIndex: 10` permanently and an overshoot would blur the section's
 * own content at rest. A MaskedView + gradient tapers the blur to transparent by the bottom.
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
  const [height, setHeight] = useState<number | null>(null)
  const handleLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)

  return (
    <View style={{ position: 'relative' }}>
      {height != null && (
        <MaskedView
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}
          maskElement={
            <LinearGradient
              colors={['black', 'black', 'transparent']}
              locations={[0, 0.6, 1]}
              style={{ flex: 1 }}
            />
          }
        >
          <BlurView intensity={30} tint="default" style={{ flex: 1 }} />
        </MaskedView>
      )}
      <Pressable
        onPress={expandable ? onToggle : undefined}
        onLayout={handleLayout}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 18,
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
