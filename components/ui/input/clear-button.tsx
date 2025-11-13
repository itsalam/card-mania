import React, { useCallback, useContext, useMemo } from 'react'
import { StyleProp, StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Assets, Button, Colors } from 'react-native-ui-lib'
import { useDidUpdate } from 'react-native-ui-lib/src/hooks'
import { FieldContext, FieldStore } from './provider'
const hitSlop = {
  top: 20,
  bottom: 20,
  left: 20,
  right: 20,
}
const NON_VISIBLE_POSITION = 18
const VISIBLE_POSITION = 0
const TIMING_CONFIG = {
  duration: 200,
  easing: Easing.bezier(0.33, 1, 0.68, 1),
}
const ClearButton = ({
  testID,
  onClear,
  onChangeText,
  clearButtonStyle,
}: {
  onClear?: () => void
  clearButtonStyle?: StyleProp<ViewStyle>
  testID?: string
  onChangeText?: (text: string) => void
}) => {
  const { hasValue } = useContext<FieldStore>(FieldContext)
  const animatedValue = useSharedValue(hasValue ? VISIBLE_POSITION : NON_VISIBLE_POSITION)
  const animatedOpacity = useSharedValue(hasValue ? 1 : 0)
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: animatedValue.value,
        },
        {
          translateX: 0,
        },
      ],
      opacity: animatedOpacity.value,
    }
  })
  const style = useMemo(
    () => [styles.buttonContainer, clearButtonStyle, animatedStyle],
    [clearButtonStyle, animatedStyle]
  )
  const animate = useCallback(() => {
    const toValue = hasValue ? VISIBLE_POSITION : NON_VISIBLE_POSITION
    animatedValue.value = withTiming(toValue, TIMING_CONFIG)
    animatedOpacity.value = withTiming(hasValue ? 1 : 0, TIMING_CONFIG)
  }, [animatedValue, animatedOpacity, hasValue])
  useDidUpdate(() => {
    animate()
  }, [hasValue, animate])
  const clear = () => {
    onChangeText?.('')
    onClear?.()
  }
  return (
    <Animated.View style={style} testID={`${testID}.container`}>
      <Button
        link
        iconSource={Assets.internal.icons.xFlat}
        iconStyle={styles.clearIcon}
        onPress={clear}
        hitSlop={hitSlop}
        accessible={hasValue}
        accessibilityLabel={'clear'}
        testID={testID}
      />
    </Animated.View>
  )
}
const styles = StyleSheet.create({
  clearIcon: {
    tintColor: Colors.$textNeutralLight,
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
export default ClearButton
