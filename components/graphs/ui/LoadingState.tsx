import { Color, Group, Mask, Rect, Skia } from '@shopify/react-native-skia'
import React, { useEffect, useMemo } from 'react'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { CartesianChart, Line, PointsArray } from 'victory-native'
import { getTimeRange } from '../helpers'
import { LineEffect } from './LineEffect'

export const FetchingDot = () => {
  const opacity = useSharedValue(0.3)
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true)
  }, [])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View
      style={[
        style,
        { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.8)' },
      ]}
    />
  )
}

type LoadingStateProps = {
  width: number
  height: number
  yKeys: string[]
}

export const LoadingState = ({ width, height, yKeys }: LoadingStateProps) => {
  const pulse = useSharedValue(0.5)
  const maskX = useSharedValue(0)

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true)
    maskX.value = withRepeat(withTiming(width, { duration: 1400 }), -1, false)
  }, [maskX, pulse, width])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }))

  const fullClip = useMemo(() => {
    const p = Skia.Path.Make()
    p.addRect(Skia.XYWHRect(0, 0, width, height))
    return p
  }, [width, height])

  const skeletonData = useMemo(() => {
    const [start, end] = getTimeRange('1M')
    const points = 10
    const step = (end.getTime() - start.getTime()) / (points - 1)
    return Array.from({ length: points }).map((_, idx) => {
      const x = start.getTime() + step * idx
      const base = 80 + idx * 2
      const wobble = Math.sin(idx / 2) * 7
      return yKeys.reduce(
        (acc, key, keyIdx) => ({
          ...acc,
          [key]: base + wobble + keyIdx * 2,
        }),
        { x }
      )
    })
  }, [yKeys])

  return (
    <Animated.View className="w-full px-6" style={[{ height }, animatedStyle]}>
      <CartesianChart
        data={skeletonData}
        xKey="x"
        yKeys={yKeys as any}
        xAxis={{ tickCount: 0 }}
        yAxis={[{ tickCount: 0 }]}
        domainPadding={{ right: 60, top: 20, bottom: 20 }}
      >
        {({ points, chartBounds }) => (
          <>
            {yKeys.map((key) => {
              //@ts-ignore
              const pts = points[key] as PointsArray
              return (
                <Line
                  key={`${key}-skeleton`}
                  points={pts}
                  strokeWidth={3}
                  color={Colors.rgba(Colors.$outlineNeutral, 0.5)}
                  curveType="natural"
                />
              )
            })}
            <Mask mask={<Rect x={maskX} y={0} width={width / 2} height={height} color="white" />}>
              {yKeys.map((key) => {
                //@ts-ignore
                const pts = points[key] as PointsArray
                return (
                  <Line
                    key={`${key}-skeleton-mask`}
                    points={pts}
                    strokeWidth={4}
                    color={Colors.rgba(Colors.$outlineDefault, 1)}
                    curveType="natural"
                  />
                )
              })}
            </Mask>
            <Group clip={fullClip}>
              {yKeys.map((yKey) => {
                const key = String(yKey)
                //@ts-ignore
                const pts = points[yKey] as PointsArray
                return (
                  <LineEffect
                    key={`${key}-effect-mask`}
                    points={pts}
                    curveType="natural"
                    connectMissingData
                    fadePx={20}
                    y0={chartBounds.bottom}
                    strokeWidth={50}
                    color={Colors.rgba(Colors.$outlineDisabled, 1.0) as Color}
                  />
                )
              })}
            </Group>
          </>
        )}
      </CartesianChart>
    </Animated.View>
  )
}
