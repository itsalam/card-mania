'use client'
import { useWishlistTotal } from '@/client/card/wishlist'
// Modified by @vincentlam
/**
 * @author: @kokonutui
 * @description: Apple Activity Card
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { AnimatePresence, MotiText, MotiView } from 'moti'
import { motifySvg } from 'moti/svg'
import { useMemo, useReducer } from 'react'
import { Pressable, View } from 'react-native'
import { Easing } from 'react-native-reanimated'
import { Circle, Defs, LinearGradient, Stop, Svg } from 'react-native-svg'

const MotiCircle = motifySvg(Circle)()

interface ActivityData {
  label: string
  value: number
  color: string
  size: number
  current: number
  target: number
  unit: string
}

interface CircleProgressProps {
  data: ActivityData
  index: number
}

const activities: ActivityData[] = [
  {
    label: 'SEEKING',
    value: (479 / 800) * 100,
    color: '#FF2D55',
    size: 200,
    current: 479,
    target: 800,
    unit: '$',
  },
  {
    label: 'SELLING',
    value: 60,
    color: '#A3F900',
    size: 160,
    current: 24,
    target: 30,
    unit: '$',
  },
  {
    label: 'HOLDING',
    value: 30,
    color: '#04C7DD',
    size: 120,
    current: 6,
    target: 12,
    unit: '$',
  },
]

export const CircleProgress = ({ data, index }: CircleProgressProps) => {
  const strokeWidth = 16
  const radius = (data.size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const progress = ((100 - data.value) / 100) * circumference

  const gradientId = `gradient-${data.label.toLowerCase()}`
  const gradientUrl = `url(#${gradientId})`

  return (
    <MotiView
      className="absolute inset-0 flex items-center justify-center"
      from={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 200, easing: Easing.out(Easing.ease) }}
    >
      <View className="relative">
        <Svg
          width={data.size}
          height={data.size}
          viewBox={`0 0 ${data.size} ${data.size}`}
          className="transform -rotate-90"
          aria-label={`${data.label} Activity Progress - ${data.value}%`}
        >
          {/* <title>{`${data.label} Activity Progress - ${data.value}%`}</title> */}

          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={data.color} stopOpacity={1} />
              <Stop
                offset="100%"
                stopColor={
                  data.color === '#FF2D55'
                    ? '#FF6B8B'
                    : data.color === '#A3F900'
                    ? '#C5FF4D'
                    : '#4DDFED'
                }
                stopOpacity={1}
              />
            </LinearGradient>
          </Defs>

          <Circle
            cx={data.size / 2}
            cy={data.size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-neutral-300/80 dark:stroke-zinc-800/50"
          />

          <MotiCircle
            cx={data.size / 2}
            cy={data.size / 2}
            r={radius}
            fill="none"
            stroke={gradientUrl}
            strokeWidth={strokeWidth}
            strokeDasharray={[`${circumference}`]}
            from={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: progress }}
            transition={{
              type: 'timing',
              duration: 800,
              delay: index * 200,
              easing: Easing.inOut(Easing.ease),
            }}
            strokeLinecap="round"
          />
          <Circle
            cx={data.size / 2}
            cy={data.size / 2}
            r={radius}
            fill="none"
            stroke={gradientUrl} // reuse your gradient
            strokeOpacity={0.0}
            strokeWidth={strokeWidth + 2} // wider than the main stroke
          />
        </Svg>
      </View>
    </MotiView>
  )
}

const DetailedActivityInfo = () => {
  return (
    <MotiView
      className="flex flex-col gap-6 ml-8"
      from={{ opacity: 0, translateX: 20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ duration: 500, delay: 300 }}
    >
      {activities.map((activity) => (
        <MotiView key={activity.label} className="flex flex-col">
          <Text className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {activity.label}
          </Text>
          <Text className="text-2xl font-semibold" style={{ color: activity.color }}>
            {activity.current}/{activity.target}
            <Text className="text-base ml-1 text-zinc-600 dark:text-zinc-400">{activity.unit}</Text>
          </Text>
        </MotiView>
      ))}
    </MotiView>
  )
}

export default function CollectionBreakdown({
  title = 'Collection Breakdown',
  className,
}: {
  title?: string
  className?: string
}) {
  const [visible, toggle] = useReducer((s) => !s, true)
  const { data: wishlistTotal, ...wishlistReq } = useWishlistTotal()
  const totals = useMemo(() => {
    const seeking = activities[0]
    const selling = activities[1]
    const holding = activities[2]
    seeking.target = wishlistTotal ?? 0
    return [seeking, selling, holding]
  }, [wishlistTotal])

  return (
    <View
      className={cn(
        'relative w-full mx-auto p-8 pt-0 rounded-3xl',
        'text-zinc-900 dark:text-white',
        className
      )}
    >
      <View className="flex flex-col items-center gap-8">
        <MotiText
          className="text-2xl font-medium text-zinc-900 dark:text-white"
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ duration: 500 }}
        >
          {title}
        </MotiText>

        <View className="flex flex-row items-center">
          <View className="relative w-[180px] h-[180px]">
            <AnimatePresence>
              {visible &&
                totals.map((activity, index) => (
                  <CircleProgress key={activity.label} data={activity} index={index} />
                ))}
            </AnimatePresence>
          </View>
          <Pressable onPress={toggle}>
            <DetailedActivityInfo />
          </Pressable>
        </View>
      </View>
    </View>
  )
}
