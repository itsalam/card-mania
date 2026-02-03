import React, { ReactNode, useCallback, useEffect } from 'react'
import {
  Modal as BaseModal,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'

import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'
import { THUMB_PADDING, THUMB_SIZE } from '../../features/tcg-card-views/DetailCardView/ui'

export const getContentInsets = (insets: EdgeInsets) => ({
  top: insets.top,
  bottom: Platform.select({ ios: insets.bottom, android: insets.bottom + 24 }),
  left: 12,
  right: 12,
})

export function Modal({
  visible,
  onDismiss,
  children,
}: {
  visible: boolean
  onDismiss: () => void
  children?: ReactNode
}) {
  const { height: screenHeight } = useWindowDimensions()
  const translateY = useSharedValue(screenHeight)

  const insets = useSafeAreaInsets()
  const contentInsets = getContentInsets(insets)
  useEffect(() => {
    if (!visible) return
    translateY.value = screenHeight
    translateY.value = withTiming(0, {
      duration: 240,
      easing: Easing.out(Easing.ease),
    })
  }, [screenHeight, translateY, visible])

  const dismiss = useCallback(() => {
    translateY.value = withTiming(
      screenHeight,
      { duration: 200, easing: Easing.in(Easing.ease) },
      (finished) => {
        if (finished) scheduleOnRN(onDismiss)
      }
    )
  }, [onDismiss, screenHeight, translateY])

  const panGesture = Gesture.Pan()
    .onChange((e) => {
      if (e.translationY > 0) translateY.value = e.translationY
    })
    .onEnd((e) => {
      const shouldDismiss = e.translationY > screenHeight * 0.2 || e.velocityY > 900
      if (shouldDismiss) {
        scheduleOnRN(dismiss)
      } else {
        translateY.value = withTiming(0, {
          duration: 200,
          easing: Easing.out(Easing.ease),
        })
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))
  return (
    <BaseModal transparent visible={visible} animationType="fade" onRequestClose={dismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.rgba(Colors.$backgroundNeutralIdle, 0.5) }}
        behavior={'translate-with-padding'}
      >
        <Pressable style={{ flex: 1 }} onPress={dismiss} />
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              thumbStyles.thumbContainer,
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: 16,
                paddingBottom: contentInsets.bottom,
                backgroundColor: Colors.$backgroundDefault,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                justifyContent: 'center',
                width: '100%',
                alignItems: 'stretch',
              },
              sheetStyle,
            ]}
          >
            <View style={[thumbStyles.thumb, { marginHorizontal: 'auto', marginBottom: 12 }]} />
            {children}
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </BaseModal>
  )
}

const { width: W, height: H } = Dimensions.get('window')
export const thumbStyles = StyleSheet.create({
  thumbContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: THUMB_PADDING,
  },
  thumb: {
    backgroundColor: Colors.rgba(Colors.$backgroundNeutralIdle, 0.3),
    height: THUMB_SIZE,
    width: '15%',
    borderRadius: 10,
  },
  mainContent: {
    width: '100%',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
  },
  sheet: {
    width: W + 4,
    position: 'absolute',
    top: '100%',
    left: -2,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: Colors.$outlineNeutral,
    borderWidth: 2,
  },

  sheetInner: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
})
