import { Text, TextClassContext } from '@/components/ui/text/base-text'
import { cn } from '@/lib/utils'
import MaskedView from '@react-native-masked-view/masked-view'
import * as TabsPrimitive from '@rn-primitives/tabs'
import { LinearGradient } from 'expo-linear-gradient'
import { LucideIcon } from 'lucide-react-native'
import { AnimatePresence, MotiView } from 'moti'
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextProps,
  View,
  ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'

// Leading edge snaps fast; trailing edge follows slowly → directional stretch effect
const SPRING_LEAD: Parameters<typeof withSpring>[1] = {
  damping: 30,
  stiffness: 400,
  mass: 0.8,
}
const SPRING_TRAIL: Parameters<typeof withSpring>[1] = {
  damping: 28,
  stiffness: 180,
  mass: 0.9,
}

const INDICATOR_PAD = 3

// ─── Indicator context ───────────────────────────────────────────────────────

interface TabIndicatorCtx {
  registerLayout: (value: string, x: number, width: number) => void
}
const TabIndicatorContext = createContext<TabIndicatorCtx | null>(null)

// ─── Shared indicator hook ───────────────────────────────────────────────────

function useTabIndicator(activeValue: string) {
  const layoutsRef = useRef<Record<string, { x: number; width: number }>>({})
  const prevValueRef = useRef<string | null>(null)
  const activeValueRef = useRef(activeValue)
  const hasInitRef = useRef(false)

  useEffect(() => {
    activeValueRef.current = activeValue
  })

  const iL = useSharedValue(0)
  const iR = useSharedValue(0)
  // Hidden until the first layout measurement lands — prevents the width=0 flash
  const iOpacity = useSharedValue(0)

  // Debounced reveal: each call cancels & restarts the delay so the indicator
  // only becomes visible after the layout width has stopped changing (e.g. after
  // async label data arrives and triggers a second onLayout).
  const reveal = useCallback(() => {
    iOpacity.value = withDelay(80, withTiming(1, { duration: 180 }))
  }, [iOpacity])

  const snapTo = useCallback(
    (l: number, r: number) => {
      iL.value = l
      iR.value = r
      reveal()
    },
    [iL, iR, reveal]
  )

  const slideTo = useCallback(
    (l: number, r: number, movingRight: boolean) => {
      if (movingRight) {
        iR.value = withSpring(r, SPRING_LEAD)
        iL.value = withSpring(l, SPRING_TRAIL)
      } else {
        iL.value = withSpring(l, SPRING_LEAD)
        iR.value = withSpring(r, SPRING_TRAIL)
      }
      reveal()
    },
    [iL, iR, reveal]
  )

  const registerLayout = useCallback(
    (value: string, x: number, width: number) => {
      const prevLayout = layoutsRef.current[value]
      layoutsRef.current[value] = { x, width }

      if (value !== activeValueRef.current) return

      if (!hasInitRef.current) {
        // Very first layout — snap without animation, then fade indicator in
        snapTo(x, x + width)
        hasInitRef.current = true
        prevValueRef.current = value
      } else if (!prevLayout) {
        // First layout for this newly-active tab; applyActiveLayout ran before layout arrived
        // → animate from previous tab position now that we have coordinates
        const prevTabLayout = prevValueRef.current ? layoutsRef.current[prevValueRef.current] : null
        const movingRight = !prevTabLayout || x >= prevTabLayout.x
        slideTo(x, x + width, movingRight)
        prevValueRef.current = value
      } else if (prevLayout.width !== width || prevLayout.x !== x) {
        // Active tab's layout changed (e.g. conditional right element appeared) → snap to new size
        snapTo(x, x + width)
      }
    },
    [snapTo, slideTo]
  )

  const applyActiveLayout = useCallback(
    (value: string, animated: boolean) => {
      const layout = layoutsRef.current[value]
      if (!layout) return false

      const newL = layout.x
      const newR = layout.x + layout.width

      if (!animated || !hasInitRef.current) {
        snapTo(newL, newR)
        hasInitRef.current = true
      } else {
        const prevLayout = prevValueRef.current ? layoutsRef.current[prevValueRef.current] : null
        const movingRight = !prevLayout || newL >= prevLayout.x
        slideTo(newL, newR, movingRight)
      }
      return true
    },
    [snapTo, slideTo]
  )

  const indicatorStyle = useAnimatedStyle(() => ({
    left: iL.value + INDICATOR_PAD,
    width: Math.max(0, iR.value - iL.value - 2 * INDICATOR_PAD),
    opacity: iOpacity.value,
  }))

  return { registerLayout, applyActiveLayout, indicatorStyle, layoutsRef, prevValueRef }
}

// ─── Components ──────────────────────────────────────────────────────────────

function Tabs({
  className,
  ...props
}: TabsPrimitive.RootProps & React.RefAttributes<TabsPrimitive.RootRef>) {
  return <TabsPrimitive.Root className={cn('flex flex-col', className)} {...props} />
}

/**
 * Standard (non-scrollable) tab list with a sliding pill indicator.
 * The indicator lives inside the flex row — triggers' onLayout.x is in
 * the same coordinate space.
 */
function TabsList({
  className,
  style,
  children,
  ...props
}: TabsPrimitive.ListProps & React.RefAttributes<TabsPrimitive.ListRef>) {
  const { value: activeValue } = TabsPrimitive.useRootContext()
  const { registerLayout, applyActiveLayout, indicatorStyle, prevValueRef } =
    useTabIndicator(activeValue)

  useEffect(() => {
    const applied = applyActiveLayout(activeValue, true)
    if (applied) prevValueRef.current = activeValue
  }, [activeValue, applyActiveLayout, prevValueRef])

  return (
    <TabIndicatorContext.Provider value={{ registerLayout }}>
      <TabsPrimitive.List
        className={cn(
          'flex flex-row items-center justify-center rounded-lg',
          Platform.select({ web: 'inline-flex w-fit', native: 'mr-auto' }),
          className
        )}
        style={StyleSheet.flatten([
          {
            backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
            borderWidth: 1,
            borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
            borderRadius: 999,
            gap: 4,
            overflow: 'hidden',
          },
          style,
        ])}
        {...props}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: INDICATOR_PAD,
              bottom: INDICATOR_PAD,
              borderRadius: 999,
              backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35),
            },
            indicatorStyle,
          ]}
        />
        {children}
      </TabsPrimitive.List>
    </TabIndicatorContext.Provider>
  )
}

/**
 * Scrollable tab list where the indicator lives INSIDE the scroll content,
 * keeping x-coordinates consistent with onLayout reports from TabsTriggers.
 *
 * @param masked    Fade edges using a LinearGradient mask (reacts to scroll position)
 * @param leftSlot  Fixed content rendered to the left of the scroll area (e.g. a sticky tab)
 * @param rightSlot Fixed content rendered to the right of the scroll area (e.g. an add button)
 */
function TabsScrollList({
  masked = false,
  leftSlot,
  rightSlot,
  children,
  style,
  className,
}: {
  masked?: boolean
  leftSlot?: ReactNode
  rightSlot?: ReactNode
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  className?: string
}) {
  const { value: activeValue } = TabsPrimitive.useRootContext()
  const { registerLayout, applyActiveLayout, indicatorStyle, layoutsRef, prevValueRef } =
    useTabIndicator(activeValue)

  const scrollViewRef = useRef<ScrollView>(null)
  const [scrollX, setScrollX] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const [visibleWidth, setVisibleWidth] = useState(0)

  // True when scrolled to the rightmost position (2px tolerance for float precision)
  const atEnd = contentWidth > 0 && visibleWidth > 0 && scrollX >= contentWidth - visibleWidth - 2

  useEffect(() => {
    const layout = layoutsRef.current[activeValue]

    // Auto-scroll the list to reveal the active tab
    if (layout && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: Math.max(0, layout.x - 8),
        animated: true,
      })
    }

    const applied = applyActiveLayout(activeValue, true)
    if (applied) prevValueRef.current = activeValue
  }, [activeValue, applyActiveLayout, layoutsRef, prevValueRef])

  // The provider is scoped to the inner scroll content View so that leftSlot/rightSlot
  // triggers (which are in a different coordinate space) don't pollute the indicator.
  const scrollContent = (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
      onContentSizeChange={(w) => setContentWidth(w)}
      onLayout={(e) => setVisibleWidth(e.nativeEvent.layout.width)}
    >
      <TabIndicatorContext.Provider value={{ registerLayout }}>
        <View style={{ flexDirection: 'row', position: 'relative' }}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: INDICATOR_PAD,
                bottom: INDICATOR_PAD,
                borderRadius: 999,
                backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35),
              },
              indicatorStyle,
            ]}
          />
          {children}
        </View>
      </TabIndicatorContext.Provider>
    </ScrollView>
  )

  const gradientColors: [string, string, string, string] =
    scrollX > 0 && !atEnd
      ? ['transparent', 'black', 'black', 'transparent'] // left + right fade
      : scrollX > 0 && atEnd
        ? ['transparent', 'black', 'black', 'black'] // left fade only
        : !atEnd
          ? ['black', 'black', 'black', 'transparent'] // right fade only
          : ['black', 'black', 'black', 'black'] // no fade (at both ends)

  const gradientLocations: [number, number, number, number] =
    scrollX > 0 && !atEnd
      ? [0, 0.025, 0.95, 1]
      : scrollX > 0 && atEnd
        ? [0, 0.025, 1, 1]
        : !atEnd
          ? [0, 0, 0.95, 1]
          : [0, 0, 1, 1]

  const middleContent = masked ? (
    <MaskedView
      style={{ flex: 1 }}
      maskElement={
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          locations={gradientLocations}
          style={{ position: 'absolute', height: '100%', width: '100%' }}
        />
      }
    >
      {scrollContent}
    </MaskedView>
  ) : (
    <View style={{ flex: 1 }}>{scrollContent}</View>
  )

  return (
    <View
      className={cn('flex flex-row items-center', className)}
      style={[
        {
          backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
          borderWidth: 1,
          borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
          borderRadius: 999,
        },
        style,
      ]}
    >
      {leftSlot}
      {middleContent}
      {rightSlot}
    </View>
  )
}

function TabsTrigger({
  className,
  style,
  onLayout: externalOnLayout,
  ...props
}: TabsPrimitive.TriggerProps & React.RefAttributes<TabsPrimitive.TriggerRef>) {
  const { value } = TabsPrimitive.useRootContext()
  const ctx = useContext(TabIndicatorContext)
  const isActive = value === props.value

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout
      ctx?.registerLayout(props.value, x, width)
      externalOnLayout?.(e)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, props.value, externalOnLayout]
  )

  return (
    <TextClassContext.Provider
      value={cn(
        'text-foreground dark:text-muted-foreground font-medium',
        isActive && 'dark:text-foreground'
      )}
    >
      <TabsPrimitive.Trigger
        onLayout={handleLayout}
        className={cn(
          'flex flex-row items-center justify-center rounded-full',
          Platform.select({
            web: 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring inline-flex cursor-default whitespace-nowrap transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
          }),
          props.disabled && 'opacity-50',
          className
        )}
        style={StyleSheet.flatten([
          {
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            alignSelf: 'stretch',
          },
          style as StyleProp<ViewStyle>,
          // Fallback active background when outside a TabIndicatorContext
          // (e.g. a fixed slot trigger not participating in the shared indicator)
          !ctx && isActive
            ? { backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35) }
            : null,
        ])}
        {...props}
      />
    </TextClassContext.Provider>
  )
}

function TabsContent({
  className,
  ...props
}: TabsPrimitive.ContentProps & React.RefAttributes<TabsPrimitive.ContentRef>) {
  return (
    <TabsPrimitive.Content
      className={cn(Platform.select({ web: 'flex-1' }), className)}
      {...props}
    />
  )
}

/**
 * Fade-crossfading tab panel. Unlike `TabsContent` (which mounts/unmounts
 * instantly), this keeps the outgoing panel mounted to run a fade-out `exit`
 * while the incoming panel fades in. Panels are absolutely positioned so the
 * two overlap during the crossfade instead of stacking — the parent must be
 * `position: 'relative'` with a defined height (e.g. a `flex: 1` region below
 * the tab list).
 */
function AnimatedTabsContent({
  value,
  children,
  style,
  duration = 180,
}: {
  value: string
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  duration?: number
}) {
  const { value: currentValue } = TabsPrimitive.useRootContext()
  const isActive = currentValue === value
  return (
    <AnimatePresence>
      {isActive ? (
        <MotiView
          key={value}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'timing', duration }}
          style={StyleSheet.flatten([StyleSheet.absoluteFill, style])}
        >
          {children}
        </MotiView>
      ) : null}
    </AnimatePresence>
  )
}

function TabsLabel({
  className,
  label,
  value,
  style,
  iconRight: IconRight,
  iconLeft: IconLeft,
  leftElement,
  rightElement,
  containerStyle,
  ...props
}: TextProps & {
  leftElement?: (current: boolean) => ReactNode | ReactNode
  rightElement?: (current: boolean) => ReactNode | ReactNode
  label?: string
  value: string
  iconRight?: LucideIcon
  iconLeft?: LucideIcon
  containerStyle?: StyleProp<ViewStyle>
}) {
  const TAB_ICON_HEIGHT = 13
  const { value: currentValue } = TabsPrimitive.useRootContext()
  const isCurrent = currentValue === value
  return (
    <View
      className="flex flex-row items-center justify-center"
      style={StyleSheet.flatten([{ gap: 5 }, containerStyle])}
    >
      {IconLeft ? (
        <IconLeft
          size={TAB_ICON_HEIGHT}
          color={isCurrent ? Colors.$backgroundPrimaryHeavy : Colors.$textNeutral}
          strokeWidth={2.5}
          style={{ marginLeft: 4 }}
        />
      ) : leftElement instanceof Function ? (
        leftElement(isCurrent)
      ) : (
        leftElement
      )}
      {label?.length && (
        <Text
          variant={'h4'}
          style={StyleSheet.flatten([
            {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              lineHeight: 18,
              color: Colors.$textNeutral,
            },
            style,
          ])}
          {...props}
        >
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </Text>
      )}
      {IconRight ? (
        <IconRight
          size={TAB_ICON_HEIGHT}
          color={isCurrent ? Colors.$backgroundPrimaryHeavy : Colors.$textNeutral}
          strokeWidth={2.5}
          style={{ marginLeft: 4 }}
        />
      ) : rightElement instanceof Function ? (
        rightElement(isCurrent)
      ) : (
        rightElement
      )}
    </View>
  )
}

export { AnimatedTabsContent, Tabs, TabsContent, TabsLabel, TabsList, TabsScrollList, TabsTrigger }
