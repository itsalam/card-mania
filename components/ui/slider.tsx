import { cn } from '@/lib/utils'
import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector, TextInput as RNText } from 'react-native-gesture-handler'
import Animated, {
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Badge } from './badge'

const SLIDER_WIDTH = 200

const AnimatedText = Animated.createAnimatedComponent(RNText)

const Thumb = ({
  minVal,
  maxVal,
  value,
  sliderWidth,
  absMin,
  absMax,
  defaultValue,
  addPlus = false,
}: {
  minVal: SharedValue<number | undefined>
  maxVal: SharedValue<number | undefined>
  value: SharedValue<number | undefined>
  defaultValue: number | undefined
  sliderWidth: number
  absMin: number
  absMax: number
  addPlus?: boolean
}) => {
  const pan = Gesture.Pan().onChange((event) => {
    const currentValue = value.value ?? defaultValue ?? 0
    const minValue = minVal.value ?? absMin
    const maxValue = maxVal.value ?? absMax
    const change = (event.changeX * (absMax - absMin)) / sliderWidth
    const newValue = Math.round(currentValue + change)
    value.value = Math.max(Math.min(newValue, maxValue), minValue)
  })

  const handleStyle = useAnimatedStyle(() => {
    const currentValue = value.value || defaultValue || 0
    return {
      transform: [
        {
          translateX: withTiming(((currentValue - absMin) / (absMax - absMin)) * sliderWidth, {
            duration: 40,
          }),
        },
      ],
    }
  })

  const textProps = useAnimatedProps(() => {
    const currentValue = value.value || defaultValue || 0
    const showMax = currentValue === absMax && addPlus
    return {
      defaultValue: showMax ? `${absMax}+` : `${currentValue}`,
      text: showMax ? `${absMax}+` : `${currentValue}`,
      minWidth: withTiming(
        ((Math.log(currentValue) * Math.LOG10E + 1) | (0 + (showMax ? 1 : 0))) * 8,
        { duration: 100 }
      ),
    }
  })

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.sliderHandleContainer, handleStyle]}>
        <Animated.View style={[styles.sliderHandle]} />
        <Animated.View style={styles.sliderHandleTextContainer}>
          <Badge className="flex items-center">
            <AnimatedText
              editable={false}
              animatedProps={textProps}
              numberOfLines={1}
              style={{ fontSize: 12, color: '#fff', textAlign: 'center' }}
            />
          </Badge>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
}

export const Slider = ({
  className = '',
  absMin = 0,
  absMax = 100,
  sliderWidth = SLIDER_WIDTH,
  min,
  max,
}: {
  className?: string
  absMin: number
  absMax: number
  min: SharedValue<number | undefined>
  max: SharedValue<number | undefined>
  sliderWidth?: number
}) => {
  const sharedAbsMin = useSharedValue<number|undefined>(absMin)
  const sharedAbsMax = useSharedValue<number|undefined>(absMax)

  useEffect(() => {
    sharedAbsMin.value = absMin
    sharedAbsMax.value = absMax
  }, [absMin, absMax])

  const sliderFillStyle = useAnimatedStyle(() => {
    const minValue = min.value || sharedAbsMin.value || 0
    const maxValue = max.value || sharedAbsMax.value || 0
    return {
      width: withTiming(sliderWidth * Math.abs((maxValue - minValue) / (absMax - absMin)), {
        duration: 40,
      }),
      transform: [
        {
          translateX: withTiming(sliderWidth * Math.abs((minValue - absMin) / (absMax - absMin)), {
            duration: 40,
          }),
        },
      ],
    }
  })
  return (
    <View className={cn("flex flex-row items-end justify-center  h-20",className)}>
      <View style={[styles.sliderTrack, { width: sliderWidth }]}>
        <Animated.View style={[styles.sliderFill, sliderFillStyle]} />
        <Thumb
          minVal={sharedAbsMin}
          maxVal={max}
          value={min}
          sliderWidth={sliderWidth}
          absMin={absMin}
          absMax={absMax}
          defaultValue={min.value || sharedAbsMin.value}
        />
        <Thumb
          minVal={min}
          maxVal={sharedAbsMax}
          value={max}
          sliderWidth={sliderWidth}
          absMin={absMin}
          absMax={absMax}
          defaultValue={max.value || sharedAbsMax.value}
          addPlus
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sliderTrack: {
    height: 8,
    backgroundColor: 'black',
    borderRadius: 25,
    justifyContent: 'center',
  },
  sliderHandleTextContainer: {
    position: 'absolute',
    transform: [{ translateX: '-50%' }, { translateY: '-110%' }],
    marginBottom: 12,
  },
  sliderHandleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 40,
    height: 40,
    position: 'absolute',
  },
  sliderHandle: {
    width: 24,
    height: 24,
    backgroundColor: '#f8f9ff',
    borderRadius: 20,
    position: 'absolute',
    left: -12,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  sliderFill: {
    left: 0,
    position: 'absolute',
    height: 8,
    backgroundColor: '#82cab2',
    zIndex: 0,
  },
  boxWidthText: {
    textAlign: 'center',
    fontSize: 18,
  },
})

export default Slider
