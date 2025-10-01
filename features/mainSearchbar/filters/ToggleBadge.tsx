import {
  CardsIcon,
  CollectionsIcon,
  OwnedIcon,
  PriceIcon,
  SealedIcon,
  SetsIcon,
  UnownedIcon,
  WishlistedIcon,
} from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import * as Haptics from 'expo-haptics'
import { LucideProps } from 'lucide-react-native'
import { ComponentProps } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { DisplayFilterLabels, FiltersKeys } from './providers'

const AnimatedView = Animated.createAnimatedComponent(View)

const LabelToBadgeIcon = {
  cards: CardsIcon,
  sets: SetsIcon,
  collections: CollectionsIcon,
  priceRange: PriceIcon,
  sealed: SealedIcon,
  owned: OwnedIcon,
  wishlisted: WishlistedIcon,
  unowned: UnownedIcon,
} as Record<FiltersKeys, (props: LucideProps) => React.JSX.Element>

export function FilterBadge({
  filterKey,
  title,
  ...props
}: ComponentProps<typeof ToggleBadge> & { filterKey: FiltersKeys }) {
  const Icon = LabelToBadgeIcon[filterKey as FiltersKeys]
  title = title || DisplayFilterLabels[filterKey as FiltersKeys]
  return (
    <ToggleBadge
      className="text-foreground"
      icon={<Icon width={20} height={20} stroke="currentColor" fill="currentColor" />}
      title={title}
      {...props}
    />
  )
}

export function ToggleBadge({
  checked,
  onPress,
  onCheckedChange,
  ...props
}: {
  title?: string
  className?: string
  icon?: React.ReactNode
  children?: React.ReactNode
  checked: boolean
  onPress?: () => void
  onCheckedChange?: (checked: boolean) => void
}) {
  const scale = useSharedValue(1)

  const onTogglePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onCheckedChange?.(!checked)
    onPress?.()
  }

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onBegin(() => {
      'worklet'
      scale.value = withTiming(0.98, { duration: 80 })
    })
    .onEnd(() => {
      'worklet'
      scale.value = withTiming(1, { duration: 80 })
      runOnJS(onTogglePress)()
    })
    .onFinalize(() => {
      'worklet'
      scale.value = withTiming(1, { duration: 80 })
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: withTiming(checked ? 1 : 0.5, { duration: 120 }),
  }))

  return (
    <GestureDetector gesture={tap}>
      <AnimatedView style={animatedStyle}>
        {/* Important: avoid inner Pressables here so RNGH owns the touch */}
        <BaseBadge {...props} />
      </AnimatedView>
    </GestureDetector>
  )
}

export function BaseBadge({
  title,
  icon,
  children,
  className,
  ...props
}: {
  title?: string
  className?: string
  icon?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <Badge
      className={cn('text-lg px-4 py-2 bg-tertiary-600 text-tertiary-foreground', className)}
      {...props}
    >
      {icon}
      <Text>{title}</Text>
      {children}
    </Badge>
  )
}
