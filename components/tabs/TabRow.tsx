import { Text } from '@/components/ui/text/base-text'
import { useRef, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'

export function TabRow<T extends any = string>(props: {
  options: { value: T; label: string }[]
  startingIdx?: number
  onValueChange?: (value: T) => void
}) {
  const { options, startingIdx = 0, onValueChange } = props
  const tabWidths = useRef<number[]>([])
  const indicatorX = useSharedValue(0)
  const indicatorWidth = useSharedValue(0)

  const [idx, setIdx] = useState(startingIdx)

  const indicatorStyle = useAnimatedStyle(() => ({
    left: indicatorX.value,
    width: indicatorWidth.value,
  }))

  function handleTabLayout(index: number, e: LayoutChangeEvent) {
    tabWidths.current[index] = e.nativeEvent.layout.width
    if (index === 0 && indicatorWidth.value === 0) {
      indicatorWidth.value = e.nativeEvent.layout.width
    }
  }

  function selectView(value: T) {
    onValueChange?.(value)
    const idx = options.findIndex((f) => f.value === value)
    setIdx(idx)
    const x = tabWidths.current.slice(0, idx).reduce((s, w) => s + w, 0)
    const w = tabWidths.current[idx] ?? 0
    const spring = { damping: 24, stiffness: 300, mass: 0.6 }
    indicatorX.value = withDelay(100, withSpring(x, spring))
    indicatorWidth.value = withSpring(w, spring)
  }

  return (
    <View
      style={[
        styles.tabRow,
        {
          borderBottomColor: Colors.$outlineNeutral,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {options.map((f, i) => (
        <Pressable
          key={String(f.value)}
          style={[
            styles.tab,
            {
              backgroundColor:
                idx === i ? Colors.$backgroundElevatedLight : Colors.$backgroundElevated,
            },
          ]}
          onLayout={(e) => handleTabLayout(i, e)}
          onPress={() => selectView(f.value)}
        >
          <Text
            style={[
              styles.tabText,
              idx === i
                ? { color: Colors.$textPrimary, fontWeight: '600' }
                : { color: Colors.$textNeutral },
            ]}
          >
            {f.label}
          </Text>
        </Pressable>
      ))}
      <Animated.View
        style={[styles.tabIndicator, { backgroundColor: Colors.$textPrimary }, indicatorStyle]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    zIndex: 0,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    borderRadius: 1,
    zIndex: 1,
  },
  tabText: {
    fontSize: 14,
  },
  tabRow: {
    flexDirection: 'row',
    position: 'relative',
  },
})
