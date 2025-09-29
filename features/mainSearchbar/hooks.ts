import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useDynamicAnimation } from 'moti'
import React, { useEffect, useState } from 'react'
import { Dimensions, Keyboard, Platform, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const useDimensions = (
  overlayRef: React.RefObject<View>,
  inputContainerRef: React.RefObject<View>
) => {
  const [searchBarHeight, setSearchbarHeight] = useState(0) // y + height (window coords)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const { height: windowHeight } = Dimensions.get('window')
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()

  const getBottomClearance = () => {
    return (keyboardHeight > 0 ? keyboardHeight : Math.max(tabBarHeight, 0)) + insets.bottom + 8
  }

  const getTabBarTop = () => {
    return windowHeight - Math.max(keyboardHeight, tabBarHeight) - searchBarHeight - insets.top
  }

  const getAvailableHeight = () => {
    return Math.max(120, windowHeight - getBottomClearance() - insets.top)
  }

  const height = useDynamicAnimation(() => ({
    maxHeight: getAvailableHeight(),
  }))

  useEffect(() => {
    height.animateTo({ maxHeight: getAvailableHeight() })
  }, [keyboardHeight])

  const measure = () => {
    if (!overlayRef.current || !inputContainerRef.current) return
    // measure inputContainer relative to overlay root
    // @ts-ignore RN types vary, runtime is fine
    inputContainerRef.current.measureLayout(
      // @ts-ignore
      overlayRef.current,
      (_x: number, y: number, _w: number, h: number) => setSearchbarHeight(h),
      () => {}
    )
  }

  useEffect(() => {
    if (overlayRef.current && inputContainerRef.current) {
      measure()
    }
  }, [overlayRef.current, inputContainerRef.current])

  useEffect(() => {
    measure()
    const dimSub = Dimensions.addEventListener('change', measure)

    // iOS: use willChangeFrame for smooth height updates
    const willChange = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
      (e: any) => {
        const kh =
          Platform.OS === 'ios'
            ? Math.max(0, windowHeight - e.endCoordinates.screenY)
            : e.endCoordinates?.height ?? 0
        setKeyboardHeight(kh)
      }
    )
    const didHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    )

    return () => {
      dimSub.remove()
      willChange.remove()
      didHide.remove()
    }
  }, [])

  return {
    searchBarHeight,
    keyboardHeight,
    height,
    getTabBarTop,
    getAvailableHeight,
    measure,
  }
}
