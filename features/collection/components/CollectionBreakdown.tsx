'use client'
import { useCollectionTotal, useWishlistTotal } from '@/client/collections/query'
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
import { formatCompactPrice } from '@/components/utils'
import { cn } from '@/lib/utils'
import { AnimatePresence, motify, MotiView } from 'moti'
import { motifySvg } from 'moti/svg'
import { useMemo, useReducer } from 'react'
import { Pressable, StyleProp, View, ViewStyle } from 'react-native'
import { Easing } from 'react-native-reanimated'
import { Circle, Defs, LinearGradient, Stop, Svg } from 'react-native-svg'
import { DefaultCollectionData } from '../helpers'
import { CircleProgressProps } from '../types'

const MotiCircle = motifySvg(Circle)()

const BASE_RING_SIZE = 80
const RING_GAP = 8
const RING_WIDTH = 18

export const CircleProgress = ({ data, index }: CircleProgressProps) => {
  const size = BASE_RING_SIZE + (RING_WIDTH + RING_GAP) * index * 2
  const radius = (size - RING_WIDTH) / 2
  const circumference = radius * 2 * Math.PI
  const value = data.current / data.target || data.value
  const progress = ((100 - value * 100) / 100) * circumference

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
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
          aria-label={`${data.label} Activity Progress - ${data.value}%`}
        >
          {/* <title>{`${data.label} Activity Progress - ${data.value}%`}</title> */}

          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={data.colors[0]} stopOpacity={1} />
              <Stop offset="100%" stopColor={data.colors[1]} stopOpacity={1} />
            </LinearGradient>
          </Defs>

          {/* <Circle
            cx={data.size / 2}
            cy={data.size / 2}
            r={radius}
            fill={Colors.$backgroundNeutral}
            strokeWidth={strokeWidth}
            color={Colors.$backgroundNeutral}
          /> */}

          <MotiCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={gradientUrl}
            strokeWidth={RING_WIDTH}
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
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill={'none'}
            stroke={gradientUrl} // reuse your gradient
            strokeOpacity={0.2}
            strokeWidth={RING_WIDTH + 2} // wider than the main stroke
          />
        </Svg>
      </View>
    </MotiView>
  )
}

const DetailedActivityInfo = () => {
  return (
    <MotiView
      className="flex flex-col gap-6"
      from={{ opacity: 0, translateX: 20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ duration: 500, delay: 300 }}
    >
      {DefaultCollectionData.map((activity) => {
        const isCurrency = activity.unit === '$'
        const currentText = isCurrency ? formatCompactPrice(activity.current) : activity.current
        const targetText = isCurrency ? formatCompactPrice(activity.target) : activity.target
        return (
          <MotiView key={activity.label} className="flex flex-col">
            <Text variant={'small'}>{activity.label}</Text>
            <View
              style={{
                display: 'flex',
                alignItems: 'center',
                flexDirection: 'row',
              }}
            >
              <Text
                variant={'h3'}
                style={{
                  color: activity.colors[1],
                  fontWeight: '400',
                }}
              >
                {currentText}/{targetText}
              </Text>

              {!isCurrency && <Text className="ml-0.5">{activity.unit}</Text>}
            </View>
          </MotiView>
        )
      })}
    </MotiView>
  )
}

const MText = motify(Text)()

export default function CollectionBreakdown({
  title = 'Collection Breakdown',
  style,
  className,
}: {
  title?: string
  style?: StyleProp<ViewStyle>
  className?: string
}) {
  const [visible, toggle] = useReducer((s) => !s, true)
  const { data: wishlistTotal, ...wishlistReq } = useWishlistTotal()
  const { data: sellingTotal } = useCollectionTotal({ collectionType: 'selling' })
  const { data: portfolioTotal } = useCollectionTotal({ collectionType: 'vault' })
  const totals = useMemo(() => {
    const seeking = DefaultCollectionData[0]
    const selling = DefaultCollectionData[1]
    const holding = DefaultCollectionData[2]
    const fullTarget = (sellingTotal ?? 0) + (wishlistTotal ?? 0) + (portfolioTotal ?? 0)
    seeking.current = wishlistTotal ?? 0
    selling.current = sellingTotal ?? 0
    seeking.target = fullTarget
    selling.target = fullTarget
    holding.target = fullTarget
    holding.current = (sellingTotal ?? 0) + (portfolioTotal ?? 0)
    return [seeking, selling, holding]
  }, [wishlistTotal, sellingTotal, portfolioTotal])

  const size = BASE_RING_SIZE + (RING_WIDTH + RING_GAP) * (totals.length - 1) * 2

  return (
    <View
      className={cn(
        'relative w-full rounded-3xl flex gap-8 mx-auto my-auto flex-row items-center justify-center',
        className
      )}
      style={style}
    >
      <View
        className="relative"
        style={{
          height: size,
          width: size,
        }}
      >
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
  )
}
